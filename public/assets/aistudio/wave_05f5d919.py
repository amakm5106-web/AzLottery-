
from __future__ import annotations

import base64
import getpass
import hashlib
import json
import logging
import os
import secrets
import sys
from typing import Any, Mapping, Optional
from urllib.parse import urljoin

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.padding import PKCS7


HOST = "https://api.wavemoney.io:8100"
WMT_MFS_HEADER = "wmt-mfs"
FINGERPRINT = "87EC104C0FFBB8E749CD59D9C64851441B38D1C13C9746DC124BB9E71E66DCB9"
APP_ID = "mm.com.wavemoney.wavepay"
USER_LANGUAGE = "en"
ACCEPT_ENCODING = "gzip, deflate, br"
VERSION_CODE = "1470"
APP_VERSION = "2.6.1"
DEFAULT_DEVICE = ""
DEFAULT_PRODUCT = "redfin"
DEFAULT_CPU_ABI = "arm64-v8a,armeabi-v7a,armeabi"
DEFAULT_MANUFACTURER = "Google"
REQUEST_TIMEOUT_SECONDS = 60

RSA_PUBLIC_KEY_1 = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4fV3EhdFo6O6ujXcji4y
6GmhX8eXP6Of0SJSVp4AVQXj9Bbb5UKW0smu/wVhqBOSBpF9dfaJcCAhXOr9XDm5
aGZVEMQIJ1UM89MgYcvZ11zQ6z8mbq775X/8TUPun1L2Z+2oIc6fu5v0VKfjFo1J
2tuK+abF9C7EOcWClyAZFpo2GB+AYk3AcGTLJ8PcbH5A8KZesBVIitYb1uSASREJ
mvbeBSOyITpnLppXOui6RIba7Kc5KPvSJxJ270+SJxrg2t6CehoDAx1JW17q1VfC
OMVWewfwge8EkQ0DVwNy7p5z6a+1BoIEdweJn83/XluyMx6sWlbnwIJvc0i6vPTX
lwIDAQAB
-----END PUBLIC KEY-----"""


RSA_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyVd3HpGdUJSJ+PMes20w
IPP0QTCTiiaMwldFnLWp8xi0hD5yY0ZXAkBYebDUQoxSCq2lSTNzI0PCHg48tOOA
c2QIB0/n/xhcr6UBIaXUVCjAiDa9NjEQ3DBs2eS9/MsTzHM4rj73+/XHK04XIUKE
upqpXSgeslanGWzu3I7HqVNPVLf2uCJp7TpCNhRCEMjOaKnteQRczTysjeZ/NaFr
zV4H1PMZClJxRUxcvWuORX1h/hmSAIYweJr9UL5xWKSnTYlR6FLLJRwIDGt9EjQF
9l15hT3kNxPPgRakfCv5sXOrALqxXQKy83m1WeR0MVvbSUx7Ct6N97M51lkQEcbw
VwIDAQAB
-----END PUBLIC KEY-----"""


class WaveError(RuntimeError):
    """Wave API, response, or local crypto error."""


class SecurityError(WaveError):
    """A sensitive action was not explicitly authorized."""


def _configure_logging() -> None:
    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wave_dashboard.log")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(log_path, encoding="utf-8"), logging.StreamHandler(sys.stderr)],
    )


def _rsa_encrypt_pkcs1v15(plaintext: str, public_pem: str) -> str:
    key = serialization.load_pem_public_key(public_pem.encode("ascii"))
    encrypted = key.encrypt(plaintext.encode("utf-8"), padding.PKCS1v15())
    return base64.b64encode(encrypted).decode("ascii")


def _aes_key(uid: str) -> bytes:
    
    return hashlib.sha1(uid.encode("utf-8")).digest()[:16]


def _aes_cbc_encrypt(plaintext: str, key: bytes, iv: bytes) -> bytes:
    padder = PKCS7(algorithms.AES.block_size).padder()
    padded = padder.update(plaintext.encode("utf-8")) + padder.finalize()
    encryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).encryptor()
    return encryptor.update(padded) + encryptor.finalize()


def _aes_cbc_decrypt(ciphertext: bytes, key: bytes, iv: bytes) -> str:
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()
    unpadder = PKCS7(algorithms.AES.block_size).unpadder()
    return (unpadder.update(padded) + unpadder.finalize()).decode("utf-8")


def _json_response(response: requests.Response) -> Any:
    try:
        return response.json()
    except (ValueError, requests.JSONDecodeError) as exc:
        raise WaveError(f"Expected JSON response (HTTP {response.status_code}).") from exc


class WaveWallet:
    """WavePay wallet API client with login, encrypted endpoints, and history fallback."""

    def __init__(self, *, phone: str, device_id: str, model: str, os_version: str,
                 wmt_mfs: str = "", timeout: float = REQUEST_TIMEOUT_SECONDS,
                 session: Optional[requests.Session] = None):
        self.base = HOST.rstrip("/")
        self.phone = phone
        self.device_id = device_id
        self.model = model
        self.os_version = os_version
        self.wmt_mfs = wmt_mfs
        self.timeout = timeout
        self.session = session or requests.Session()
        self.agent_id: Optional[int] = None
        self.device = f"{model}({model})" if model else DEFAULT_DEVICE
        self.product = DEFAULT_PRODUCT
        self.cpu_abi = DEFAULT_CPU_ABI
        self.manufacturer = DEFAULT_MANUFACTURER

    def _headers(self) -> dict[str, str]:
        return {
            "fingerprint": FINGERPRINT,
            "appId": APP_ID,
            "userLanguage": USER_LANGUAGE,
            "accept-encoding": ACCEPT_ENCODING,
            "versionCode": VERSION_CODE,
            "appVersion": APP_VERSION,
            "deviceId": self.device_id,
            "device": self.device,
            "product": self.product,
            "cpuAbi": self.cpu_abi,
            "manufacturer": self.manufacturer,
            "model": self.model,
            "osVersion": self.os_version,
            "user-agent": "okhttp/4.9.0",
            WMT_MFS_HEADER: self.wmt_mfs,
        }

    def _request(self, method: str, path: str, *, params: Optional[Mapping[str, Any]] = None,
                 data: Any = None, json_body: Any = None,
                 headers: Optional[Mapping[str, str]] = None,
                 allow_http_error: bool = False) -> requests.Response:
        url = f"{self.base}/{path.lstrip('/')}"
        request_headers = self._headers()
        request_headers.update(headers or {})
        try:
            response = self.session.request(method, url, params=params, data=data, json=json_body,
                                            headers=request_headers, timeout=self.timeout)
        except requests.Timeout as exc:
            logging.error("Wave request timed out: %s %s", method, path)
            raise WaveError(f"Request timed out: {method} {path}") from exc
        except requests.RequestException as exc:
            logging.error("Wave network request failed: %s %s (%s)", method, path, type(exc).__name__)
            raise WaveError(f"Network error for {method} {path}: {exc}") from exc
        self.wmt_mfs = response.headers.get(WMT_MFS_HEADER, self.wmt_mfs)
        logging.info("Wave HTTP %s %s -> %s", method, path, response.status_code)
        if not allow_http_error and not 200 <= response.status_code < 300:
            raise WaveError(f"HTTP {response.status_code} for {method} {path}.")
        return response

    def request_otp(self) -> Any:
        response = self._request("GET", "v3/wmt-mfs-otp/generate-otp", params={"msisdn": self.phone})
        return _json_response(response)

    def security_token(self) -> str:
        response = self._request(
            "GET", "v3/wmt-mfs-otp/security-token", params={"msisdn": self.phone},
            headers={"user-agent": "Dart/3.6.0 (dart:io)"},
        )
        result = _json_response(response)
        if not _is_success(result):
            raise WaveError(f"Wave security-token failed: {result.get('message', result)}")
        token = (result.get("responseMap") or {}).get("securityCounter")
        if not token:
            raise WaveError("Wave security-token response missing securityCounter")
        return str(token)

    def confirm_otp(self, otp: str) -> Any:
        response = self._request("POST", "v3/wmt-mfs-otp/confirm-otp",
                                 data={"msisdn": self.phone, "otp": otp})
        return _json_response(response)

    @staticmethod
    def _encrypt_login_secret(value: str, counter: str) -> str:
        # PIN/password encryption uses rsaPublicKey1 (not the request-header key).
        return _rsa_encrypt_pkcs1v15(f"{value}:{counter}", RSA_PUBLIC_KEY_1)

    def login(self, pin: str, otp: str) -> Any:
        confirmed = self.confirm_otp(otp)
        if not _is_success(confirmed):
            raise WaveError(f"Wave OTP confirmation failed: {confirmed.get('message', confirmed)}")
        password_counter = self.security_token()
        pin_counter = self.security_token()
        body = {
            "msisdn": self.phone,
            "password": self._encrypt_login_secret(pin, password_counter),
            "pin": self._encrypt_login_secret(pin, pin_counter),
        }
        response = self._request("POST", "v3/mfs-customer/login", data=body)
        result = _json_response(response)
        self.agent_id = (result.get("responseMap") or {}).get("agentId")
        return result

    def wallet_balance(self) -> Any:
        return _json_response(self._request("GET", "v2/mfs-customer/wallet-balance"))

    def _encrypted_request_header(self) -> tuple[str, str, bytes, bytes]:
        uid = secrets.token_hex(4)  # Wave UID is 8 lowercase hex characters.
        iv = secrets.token_bytes(16)
        iv_b64 = base64.b64encode(iv).decode("ascii")
        # Encrypted request headers use rsaPublicKey.
        key_header = _rsa_encrypt_pkcs1v15(f"{uid}:{iv_b64}", RSA_PUBLIC_KEY)
        return uid, iv_b64, iv, key_header

    def _encrypted_get(self, path: str) -> Any:
        uid, _iv_b64, iv, key_header = self._encrypted_request_header()
        response = self._request("GET", path, headers={"key": key_header, "Content-Type": "text/plain"})
        try:
            plaintext = _aes_cbc_decrypt(base64.b64decode(response.text, validate=True), _aes_key(uid), iv)
        except Exception as exc:
            raise WaveError(f"Could not decrypt Wave response for {path}: {type(exc).__name__}") from exc
        try:
            return json.loads(plaintext)
        except json.JSONDecodeError:
            return {"body": plaintext}

    def registered_devices(self) -> Any:
        
        return self._encrypted_get("v3/mfs-customer/registered-devices")

    def get_kyc_info(self) -> Any:
        return self._encrypted_get("v3/mfs-customer/get-kyc-info")

    def subscriber_profile(self) -> Any:
        return self._encrypted_get("v3/mfs-customer/get-subscriber-profile")

    def self_authorization_eligibility(self) -> Any:
        return self._encrypted_get("v3/mfs-customer/self-authorization-eligiblity")

    def register_device(self, agent_id: Optional[int] = None) -> Any:
        """PATCH a device using Wave's AES-CBC/PKCS7 body and RSA-encrypted key header."""
        uid, iv_b64, iv, key_header = self._encrypted_request_header()
        body_obj = {
            "agentId": agent_id if agent_id is not None else self.agent_id,
            "pin": "",
            "deviceAuthorizationStatus": "1",
            "deviceIdToPatch": self.device_id,
        }
        serialized = json.dumps(body_obj, ensure_ascii=False, separators=(",", ":"))
        cipher_b64 = base64.b64encode(_aes_cbc_encrypt(serialized, _aes_key(uid), iv)).decode("ascii")
        response = self._request(
            "PATCH", "v3/mfs-customer/registered-devices", data=cipher_b64,
            headers={"key": key_header, "Content-Type": "text/plain"},
        )
        try:
            plaintext = _aes_cbc_decrypt(base64.b64decode(response.text, validate=True), _aes_key(uid), iv)
            return json.loads(plaintext)
        except Exception as exc:
            raise WaveError(f"Could not decrypt device registration response: {type(exc).__name__}") from exc

    def save_notification_token(self, notification_token: str = "") -> Any:
        response = self._request(
            "POST", "v2/mfs-customer/save-notification-token",
            data={"msisdn": self.phone, "notificationToken": notification_token},
        )
        return _json_response(response)

    def check_beneficiary(self, msisdn: str) -> Any:
        response = self._request(
            "POST", "v2/mfs-customer/check-mfs-beneficiary", json_body={"msisdn": msisdn},
            headers={"user-agent": "Dart/3.6.0 (dart:io)", "Content-Type": "application/json"},
        )
        return _json_response(response)

    def transfer(self, *, receiver: str, amount: str, pin: str,
                 allow_money_transfer: bool = False) -> Any:
        if not allow_money_transfer:
            raise SecurityError("WavePay transfer canceled: explicit typed CONFIRM is required.")
        recipient = self.check_beneficiary(receiver)
        sender = self.check_beneficiary(self.phone)
        recipient_name = (recipient.get("responseMap") or {}).get("name")
        sender_name = (sender.get("responseMap") or {}).get("name")
        if not recipient_name or not sender_name:
            raise WaveError("Could not resolve WavePay sender and recipient names; transfer stopped.")
        encrypted_pin = self._encrypt_login_secret(pin, self.security_token())
        payload = {
            "receiverName": recipient_name,
            "senderName": sender_name,
            "receiverMsisdn": receiver,
            "amount": str(amount),
            "pin": encrypted_pin,
            "note": "",
        }
        response = self._request(
            "POST", "v2/mfs-customer/send-money-ma", data=payload,
            headers={"user-agent": "Dart/3.6.0 (dart:io)"},
        )
        return _json_response(response)

    def transaction_history(self, *, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        """Best-effort history flow: initialize browser endpoint then query utility API."""
        limit = max(1, min(int(limit), 20))
        offset = max(0, int(offset))
        referer = f"{self.base}/v2/wave-tnx-history/?mixpanel_source=Home+Screen"
        browser_headers = {
            "user-agent": (
                f"Mozilla/5.0 (Linux; Android {self.os_version}; {self.model} "
                "Build/RD1A.200810.022.A4; wv) AppleWebKit/537.36 (KHTML, like Gecko) "
                "Version/4.0 Chrome/147.0.7727.137 Mobile Safari/537.36"
            ),
            "accept": "*/*",
            "content-type": "application/json",
            "referer": referer,
            "accept-encoding": ACCEPT_ENCODING,
            "origin": self.base,
            "x-requested-with": APP_ID,
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "cors",
            "sec-fetch-dest": "empty",
            WMT_MFS_HEADER: self.wmt_mfs,
        }
        try:
            splash = self._request("GET", f"v2/wave-tnx-history/splash", headers=browser_headers,
                                   allow_http_error=True)
            cookie = splash.headers.get("set-cookie", "")
            cf_cookie = next((part.strip() for part in cookie.split(";") if part.strip().startswith("__cf_bm=")), "")
            if cf_cookie:
                name, value = cf_cookie.split("=", 1)
                self.session.cookies.set(name, value)
            url = f"{self.base}/merchant-app/tnxhistory-utility/v2/tnx-histories"
            response = self.session.request(
                "GET", url, params={"limit": limit, "offset": offset},
                headers={**browser_headers, WMT_MFS_HEADER: self.wmt_mfs}, timeout=self.timeout,
            )
            self.wmt_mfs = response.headers.get(WMT_MFS_HEADER, self.wmt_mfs)
            logging.info("Wave history HTTP GET utility -> %s", response.status_code)
            try:
                body: Any = response.json()
            except ValueError:
                body = response.text
            return {
                "status": response.status_code,
                "body": body,
                "nextWmtMfs": response.headers.get(WMT_MFS_HEADER),
                "contentType": response.headers.get("content-type"),
                "cfRay": response.headers.get("cf-ray"),
                "limit": limit,
                "offset": offset,
            }
        except (WaveError, requests.RequestException) as exc:
            logging.exception("Wave transaction history request failed")
            return {"status": None, "error": str(exc), "limit": limit, "offset": offset}


def _is_success(result: Any) -> bool:
    if not isinstance(result, dict):
        return False
    status = result.get("statusCode")
    return status in (0, "0", 200, "200")


def _print_result(result: Any) -> None:
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


def _prompt(label: str, default: Optional[str] = None) -> str:
    suffix = f" [{default}]" if default is not None else ""
    value = input(f"{label}{suffix}: ").strip()
    return value if value else (default or "")


def _secret(label: str) -> str:
    return getpass.getpass(f"{label}: ")


def _new_client() -> WaveWallet:
    phone = _prompt("Wave phone number")
    model = _prompt("Phone model", "Xiaomi 12")
    os_version = _prompt("Android OS version", "13")
    proposed_device_id = secrets.token_hex(20)
    device_id = _prompt("Device ID (40 hex; blank uses a generated ID)", proposed_device_id)
    wmt_mfs = getpass.getpass("Current WMT-MFS token (blank if none): ").strip()
    return WaveWallet(phone=phone, device_id=device_id, model=model, os_version=os_version, wmt_mfs=wmt_mfs)


def _typed_transfer_confirmation() -> bool:
    print("\nWARNING: this action can move real money and cannot be undone.")
    return input('Type CONFIRM exactly to authorize this transfer: ').strip() == "CONFIRM"


def _run_action(label: str, callback) -> None:
    try:
        result = callback()
        _print_result(result)
    except (WaveError, ValueError, requests.RequestException) as exc:
        logging.error("%s failed: %s", label, exc)
        print(f"Error: {exc}", file=sys.stderr)
    except KeyboardInterrupt:
        print("\nCanceled.")


def dashboard() -> int:
    client: Optional[WaveWallet] = None
    print("WavePay Terminal Dashboard — WaveWallet only")
    while True:
        print("\n[WAVEPAY]")
        print("1 Request OTP               2 Login with OTP/PIN")
        print("3 Wallet balance            4 Registered devices (GET)")
        print("5 Register/authorize device (PATCH)")
        print("6 KYC information           7 Subscriber profile")
        print("8 Self-authorization eligibility")
        print("9 Save notification token   10 Check beneficiary")
        print("11 Send money (typed CONFIRM required)")
        print("12 Transaction history      13 Update WMT-MFS token")
        print("0 Exit")
        try:
            choice = input("Select: ").strip()
        except EOFError:
            print()
            return 0
        if choice == "0":
            print("Goodbye.")
            return 0
        if choice not in {str(i) for i in range(1, 14)}:
            print("Unknown menu choice.")
            continue
        try:
            if client is None:
                client = _new_client()
        except (EOFError, KeyboardInterrupt):
            print("\nSetup canceled; returning to menu.")
            continue
        try:
            if choice == "1":
                _run_action("OTP request", client.request_otp)
            elif choice == "2":
                otp = _secret("OTP")
                pin = _secret("Wave PIN")
                _run_action("Login", lambda: client.login(pin, otp))
            elif choice == "3":
                _run_action("Wallet balance", client.wallet_balance)
            elif choice == "4":
                _run_action("Registered devices GET", client.registered_devices)
            elif choice == "5":
                _run_action("Register device PATCH", client.register_device)
            elif choice == "6":
                _run_action("KYC information", client.get_kyc_info)
            elif choice == "7":
                _run_action("Subscriber profile", client.subscriber_profile)
            elif choice == "8":
                _run_action("Authorization eligibility", client.self_authorization_eligibility)
            elif choice == "9":
                token = getpass.getpass("Notification token (blank allowed): ")
                _run_action("Save notification token", lambda: client.save_notification_token(token))
            elif choice == "10":
                beneficiary = _prompt("Beneficiary phone number")
                _run_action("Beneficiary check", lambda: client.check_beneficiary(beneficiary))
            elif choice == "11":
                receiver = _prompt("Recipient phone number")
                amount = _prompt("Amount")
                if not _typed_transfer_confirmation():
                    print("Transfer canceled; CONFIRM was not entered.")
                    continue
                pin = _secret("Wave PIN")
                _run_action("Money transfer", lambda: client.transfer(
                    receiver=receiver, amount=amount, pin=pin, allow_money_transfer=True))
            elif choice == "12":
                limit = int(_prompt("History limit (1–20)", "20"))
                offset = int(_prompt("History offset", "0"))
                _run_action("Transaction history", lambda: client.transaction_history(limit=limit, offset=offset))
            elif choice == "13":
                client.wmt_mfs = getpass.getpass("WMT-MFS token (blank clears it): ").strip()
                print("WMT-MFS token updated in memory (not logged or saved).")
        except (EOFError, KeyboardInterrupt):
            print("\nAction canceled.")


def self_test() -> None:
    # Offline-only assertions: no HTTP requests or live API calls are made.
    assert serialization.load_pem_public_key(RSA_PUBLIC_KEY_1.encode()).key_size == 2048
    assert serialization.load_pem_public_key(RSA_PUBLIC_KEY.encode()).key_size == 2048
    assert RSA_PUBLIC_KEY_1 != RSA_PUBLIC_KEY
    uid = "443b1af1"
    iv = bytes(range(16))
    plaintext = '{"agentId":123,"pin":"","deviceAuthorizationStatus":"1","deviceIdToPatch":"abc"}'
    ciphertext = _aes_cbc_encrypt(plaintext, _aes_key(uid), iv)
    assert _aes_cbc_decrypt(ciphertext, _aes_key(uid), iv) == plaintext
    # Verify the RSA key split: login secrets and request header encrypt independently.
    login_cipher = _rsa_encrypt_pkcs1v15("0000:counter", RSA_PUBLIC_KEY_1)
    header_cipher = _rsa_encrypt_pkcs1v15(f"{uid}:{base64.b64encode(iv).decode()}", RSA_PUBLIC_KEY)
    assert len(base64.b64decode(login_cipher)) == 256
    assert len(base64.b64decode(header_cipher)) == 256
    client = WaveWallet(phone="+95000000000", device_id="d" * 40, model="Pixel 5", os_version="14")
    assert client._headers()["appId"] == APP_ID
    assert client._headers()["versionCode"] == "1470"
    try:
        client.transfer(receiver="+95000000001", amount="1", pin="0000")
    except SecurityError:
        pass
    else:
        raise AssertionError("transfer must require explicit opt-in")
    print("Offline self-test passed (crypto/config/gating; no network requests).")


def main(argv: Optional[list[str]] = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if args and args[0] in {"-h", "--help"}:
        print("Usage: wave_dashboard.py [--self-test]\nStandalone WavePay-only terminal dashboard.")
        return 0
    _configure_logging()
    if args and args[0] == "--self-test":
        self_test()
        return 0
    if args:
        print("Usage: wave_dashboard.py [--self-test]", file=sys.stderr)
        return 2
    try:
        return dashboard()
    except KeyboardInterrupt:
        print("\nGoodbye.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())