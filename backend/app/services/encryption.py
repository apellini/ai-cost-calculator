"""
Encryption utilities for storing sensitive data (API keys) in the database.

Uses Fernet symmetric encryption with keys stored in environment variables.
"""
import base64
import os
from cryptography.fernet import Fernet, InvalidToken
from typing import Optional


def get_encryption_key() -> bytes:
    """
    Get the encryption key from environment variable.
    Creates a new key if none exists (for development only).
    """
    key = os.environ.get("ENCRYPTION_KEY")
    if key:
        # Verify it's valid base64
        try:
            decoded = base64.urlsafe_b64decode(key)
            if len(decoded) == 32:
                return decoded
        except Exception:
            pass

    # Generate a new key if not found (development only!)
    # In production, this should fail and require the key to be set
    import warnings
    warnings.warn(
        "ENCRYPTION_KEY not set. A new key will be generated, but this will prevent "
        "decryption of existing data on restart. Set ENCRYPTION_KEY in environment.",
        RuntimeWarning
    )
    return generate_key()


def generate_key() -> bytes:
    """Generate a new Fernet key."""
    return Fernet.generate_key()


def encrypt_value(value: str, key: Optional[bytes] = None) -> tuple[str, str]:
    """
    Encrypt a value using Fernet encryption.

    Args:
        value: The plaintext value to encrypt
        key: Optional encryption key. If None, uses key from environment.

    Returns:
        Tuple of (encrypted_value, iv) where IV is the key used for decryption
    """
    if key is None:
        key = get_encryption_key()

    fernet = Fernet(key)
    encrypted = fernet.encrypt(value.encode())
    return encrypted.decode(), base64.urlsafe_b64encode(key).decode()


def decrypt_value(encrypted: str, key: bytes) -> Optional[str]:
    """
    Decrypt a value using Fernet encryption.

    Args:
        encrypted: The encrypted value
        key: The encryption key (as bytes)

    Returns:
        Decrypted plaintext or None if decryption fails
    """
    try:
        fernet = Fernet(key)
        return fernet.decrypt(encrypted.encode()).decode()
    except InvalidToken:
        return None
    except Exception:
        return None


def get_decrypted_api_key(source: "PricingSource") -> Optional[str]:
    """
    Get the decrypted API key from a PricingSource object.

    Args:
        source: The PricingSource object containing encrypted_key and key_iv

    Returns:
        The decrypted API key, or None if not configured or decryption fails
    """
    if not source.api_key_encrypted:
        return None

    try:
        key = base64.urlsafe_b64decode(source.api_key_iv)
        return decrypt_value(source.api_key_encrypted, key)
    except Exception:
        return None
