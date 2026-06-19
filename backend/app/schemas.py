from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    sku: str = Field(min_length=1, max_length=80)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    quantity_in_stock: int = Field(ge=0)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    pass


class ProductRead(ProductBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=180)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=40)


class CustomerCreate(CustomerBase):
    pass


class CustomerRead(CustomerBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderItemRead(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    product: ProductRead | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderRead(BaseModel):
    id: int
    customer_id: int
    total_amount: Decimal
    status: str
    customer: CustomerRead | None = None
    items: list[OrderItemRead]

    model_config = ConfigDict(from_attributes=True)

