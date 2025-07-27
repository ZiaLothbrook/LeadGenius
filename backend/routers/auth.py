"""
Authentication router for FastAPI backend
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import os
from database import get_database
from services.redis_service import redis_client
import uuid

router = APIRouter()
security = HTTPBearer()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    first_name: str
    last_name: str

class Token(BaseModel):
    access_token: str
    token_type: str

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get user from database
    db = await get_database()
    query = "SELECT * FROM users WHERE id = :user_id"
    user = await db.fetch_one(query, {"user_id": user_id})
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return dict(user)

@router.post("/register", response_model=UserResponse)
async def register_user(user_data: UserRegister):
    """Register a new user"""
    db = await get_database()
    
    # Check if user already exists
    existing_user = await db.fetch_one(
        "SELECT id FROM users WHERE username = :username OR email = :email",
        {"username": user_data.username, "email": user_data.email}
    )
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    user_id = str(uuid.uuid4())
    query = """
        INSERT INTO users (id, username, email, password, first_name, last_name, created_at, updated_at)
        VALUES (:id, :username, :email, :password, :first_name, :last_name, NOW(), NOW())
        RETURNING id, username, email, first_name, last_name
    """
    
    user = await db.fetch_one(query, {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_password,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name
    })
    
    return UserResponse(**dict(user))

@router.post("/login", response_model=Token)
async def login_user(user_data: UserLogin):
    """Login user and return JWT token"""
    db = await get_database()
    
    # Get user from database
    user = await db.fetch_one(
        "SELECT * FROM users WHERE username = :username",
        {"username": user_data.username}
    )
    
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    # Store session in Redis
    await redis_client.set_json(
        f"session:{user['id']}",
        {"user_id": user["id"], "username": user["username"]},
        expire=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/user", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        first_name=current_user["first_name"],
        last_name=current_user["last_name"]
    )

@router.post("/logout")
async def logout_user(current_user: dict = Depends(get_current_user)):
    """Logout user and invalidate session"""
    # Remove session from Redis
    await redis_client.delete(f"session:{current_user['id']}")
    
    return {"message": "Successfully logged out"}