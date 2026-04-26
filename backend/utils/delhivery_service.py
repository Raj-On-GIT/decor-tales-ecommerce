from dataclasses import dataclass
import json
from urllib.parse import urljoin

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .logging_helpers import mask_sensitive


@dataclass(frozen=True)
class DelhiveryConfig:
    base_url: str
    api_key: str

    @property
    def is_configured(self):
        return bool(self.base_url and self.api_key)

    def masked_api_key(self):
        return mask_sensitive(self.api_key)


def get_delhivery_config(*, required=False):
    config = DelhiveryConfig(
        base_url=getattr(settings, "DELHIVERY_BASE_URL", "").strip(),
        api_key=getattr(settings, "DELHIVERY_API_KEY", "").strip(),
    )

    if required and not config.is_configured:
        raise ImproperlyConfigured(
            "DELHIVERY_BASE_URL and DELHIVERY_API_KEY must be configured."
        )

    return config


class DelhiveryServiceError(Exception):
    pass


class DelhiveryService:
    """
    Centralized Delhivery service scaffold.

    This class intentionally contains only configuration and URL composition
    helpers for now. Request methods should be added in later steps once the
    exact Delhivery API contract is confirmed.
    """

    def __init__(self, config=None):
        self.config = config or get_delhivery_config()

    @property
    def is_configured(self):
        return self.config.is_configured

    def require_configuration(self):
        if not self.is_configured:
            raise ImproperlyConfigured(
                "DELHIVERY_BASE_URL and DELHIVERY_API_KEY must be configured."
            )

    def build_url(self, path=""):
        self.require_configuration()

        normalized_base_url = f"{self.config.base_url.rstrip('/')}/"
        normalized_path = str(path or "").lstrip("/")
        return urljoin(normalized_base_url, normalized_path)

    def get_headers(self):
        self.require_configuration()
        return {
            "Authorization": f"Token {self.config.api_key}",
        }

    def get_pincode_serviceability(self, *, pincode, timeout=15):
        self.require_configuration()

        try:
            response = requests.get(
                self.build_url("/c/api/pin-codes/json/"),
                headers=self.get_headers(),
                params={"filter_codes": str(pincode).strip()},
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise DelhiveryServiceError(
                "Unable to connect to Delhivery service."
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise DelhiveryServiceError(
                "Delhivery returned a non-JSON response."
            ) from exc

        if not response.ok:
            raise DelhiveryServiceError(
                f"Delhivery request failed with status {response.status_code}."
            )

        return payload

    def get_expected_tat(
        self,
        *,
        origin_pin,
        destination_pin,
        mot,
        pdt="",
        expected_pickup_date="",
        timeout=15,
    ):
        self.require_configuration()

        params = {
            "origin_pin": str(origin_pin).strip(),
            "destination_pin": str(destination_pin).strip(),
            "mot": str(mot).strip(),
        }

        if str(pdt or "").strip():
            params["pdt"] = str(pdt).strip()

        if str(expected_pickup_date or "").strip():
            params["expected_pickup_date"] = str(expected_pickup_date).strip()

        try:
            response = requests.get(
                self.build_url("/api/dc/expected_tat"),
                headers=self.get_headers(),
                params=params,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise DelhiveryServiceError(
                "Unable to connect to Delhivery service."
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise DelhiveryServiceError(
                "Delhivery returned a non-JSON response."
            ) from exc

        if not response.ok:
            raise DelhiveryServiceError(
                f"Delhivery request failed with status {response.status_code}."
            )

        return payload

    def create_shipment(self, *, data, timeout=30):
        self.require_configuration()

        try:
            response = requests.post(
                self.build_url("/api/cmu/create.json"),
                headers={
                    **self.get_headers(),
                    "Accept": "application/json",
                },
                data={
                    "format": "json",
                    "data": json.dumps(data),
                },
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise DelhiveryServiceError(
                "Unable to connect to Delhivery service."
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise DelhiveryServiceError(
                "Delhivery returned a non-JSON response."
            ) from exc

        if not response.ok:
            raise DelhiveryServiceError(
                f"Delhivery request failed with status {response.status_code}."
            )

        return payload

    def track_shipment(self, *, waybill, ref_ids="", timeout=20):
        self.require_configuration()

        params = {
            "waybill": str(waybill).strip(),
        }

        if str(ref_ids or "").strip():
            params["ref_ids"] = str(ref_ids).strip()

        try:
            response = requests.get(
                self.build_url("/api/v1/packages/json/"),
                headers={
                    **self.get_headers(),
                    "Content-Type": "application/json",
                },
                params=params,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise DelhiveryServiceError(
                "Unable to connect to Delhivery service."
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise DelhiveryServiceError(
                "Delhivery returned a non-JSON response."
            ) from exc

        if not response.ok:
            raise DelhiveryServiceError(
                f"Delhivery request failed with status {response.status_code}."
            )

        return payload

    def generate_shipping_label(self, *, waybill, pdf=True, pdf_size="4R", timeout=20):
        self.require_configuration()

        params = {
            "wbns": str(waybill).strip(),
            "pdf": "true" if pdf else "false",
        }

        if str(pdf_size or "").strip():
            params["pdf_size"] = str(pdf_size).strip()

        try:
            response = requests.get(
                self.build_url("/api/p/packing_slip"),
                headers={
                    **self.get_headers(),
                    "Content-Type": "application/json",
                },
                params=params,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise DelhiveryServiceError(
                "Unable to connect to Delhivery service."
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise DelhiveryServiceError(
                "Delhivery returned a non-JSON response."
            ) from exc

        if not response.ok:
            raise DelhiveryServiceError(
                f"Delhivery request failed with status {response.status_code}."
            )

        return payload

    def describe_configuration(self):
        return {
            "base_url": self.config.base_url,
            "api_key": self.config.masked_api_key(),
            "configured": self.is_configured,
        }
