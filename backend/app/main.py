from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .config import settings
from .database import Base, engine, get_db
from .models import Customer, Order, OrderItem, Product
from .schemas import (
    CustomerCreate,
    CustomerRead,
    OrderCreate,
    OrderRead,
    ProductCreate,
    ProductRead,
    ProductUpdate,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Inventory & Order Management API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def handle_integrity_error(error: IntegrityError) -> None:
    detail = str(error.orig).lower()
    if "products_sku" in detail or "sku" in detail:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product SKU must be unique.")
    if "customers_email" in detail or "email" in detail:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer email must be unique.")
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request conflicts with existing data.")


def get_product_or_404(product_id: int, db: Session) -> Product:
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    return product


def get_customer_or_404(customer_id: int, db: Session) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    return customer


def get_order_or_404(order_id: int, db: Session) -> Order:
    order = (
        db.query(Order)
        .options(selectinload(Order.customer), selectinload(Order.items).selectinload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return order


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        handle_integrity_error(error)
    db.refresh(product)
    return product


@app.get("/products", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).order_by(Product.id.desc()).all()


@app.get("/products/{product_id}", response_model=ProductRead)
def read_product(product_id: int, db: Session = Depends(get_db)):
    return get_product_or_404(product_id, db)


@app.put("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = get_product_or_404(product_id, db)
    for key, value in payload.model_dump().items():
        setattr(product, key, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        handle_integrity_error(error)
    db.refresh(product)
    return product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = get_product_or_404(product_id, db)
    if product.order_items:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Products used in orders cannot be deleted.")
    db.delete(product)
    db.commit()


@app.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        handle_integrity_error(error)
    db.refresh(customer)
    return customer


@app.get("/customers", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).order_by(Customer.id.desc()).all()


@app.get("/customers/{customer_id}", response_model=CustomerRead)
def read_customer(customer_id: int, db: Session = Depends(get_db)):
    return get_customer_or_404(customer_id, db)


@app.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = get_customer_or_404(customer_id, db)
    if customer.orders:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customers with orders cannot be deleted.")
    db.delete(customer)
    db.commit()


@app.post("/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    get_customer_or_404(payload.customer_id, db)
    requested_quantities: dict[int, int] = {}
    for item in payload.items:
        requested_quantities[item.product_id] = requested_quantities.get(item.product_id, 0) + item.quantity

    products = (
        db.query(Product)
        .filter(Product.id.in_(requested_quantities.keys()))
        .with_for_update()
        .all()
    )
    products_by_id = {product.id: product for product in products}

    missing_ids = set(requested_quantities) - set(products_by_id)
    if missing_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product not found: {sorted(missing_ids)[0]}.")

    for product_id, quantity in requested_quantities.items():
        product = products_by_id[product_id]
        if product.quantity_in_stock < quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {product.name}. Available: {product.quantity_in_stock}.",
            )

    total_amount = Decimal("0.00")
    order = Order(customer_id=payload.customer_id, total_amount=total_amount)
    db.add(order)
    db.flush()

    for product_id, quantity in requested_quantities.items():
        product = products_by_id[product_id]
        product.quantity_in_stock -= quantity
        line_total = product.price * quantity
        total_amount += line_total
        db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=quantity, unit_price=product.price))

    order.total_amount = total_amount
    db.commit()
    return get_order_or_404(order.id, db)


@app.get("/orders", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db)):
    return (
        db.query(Order)
        .options(selectinload(Order.customer), selectinload(Order.items).selectinload(OrderItem.product))
        .order_by(Order.id.desc())
        .all()
    )


@app.get("/orders/{order_id}", response_model=OrderRead)
def read_order(order_id: int, db: Session = Depends(get_db)):
    return get_order_or_404(order_id, db)


@app.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = get_order_or_404(order_id, db)
    for item in order.items:
        product = db.get(Product, item.product_id)
        if product:
            product.quantity_in_stock += item.quantity
    db.delete(order)
    db.commit()

