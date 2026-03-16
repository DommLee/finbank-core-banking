import uuid
from datetime import datetime, timezone

import xmltodict


def generate_message_id():
    """Generates a generic ISO20022 message ID"""
    return f"FINB-{uuid.uuid4().hex[:12].upper()}"


def generate_pacs008_xml(
    amount: float,
    currency: str,
    sender_name: str,
    sender_iban: str,
    receiver_name: str,
    receiver_iban: str,
    receiver_bank_bic: str = "UNKNOWN",
    description: str = "Transfer",
) -> str:
    """
    Generates an ISO 20022 `pacs.008.001.08` XML string for inter-bank transfers.
    """
    msg_id = generate_message_id()
    end_to_end_id = f"E2E-{msg_id}"
    creation_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # pacs.008 structure mapping
    pacs008_dict = {
        "Document": {
            "@xmlns": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
            "FIToFICstmrCdtTrf": {
                "GrpHdr": {
                    "MsgId": msg_id,
                    "CreDtTm": creation_time,
                    "NbOfTxs": "1",
                    "SttlmInf": {"SttlmMtd": "CLRG"},
                },
                "CdtTrfTxInf": {
                    "PmtId": {"EndToEndId": end_to_end_id},
                    "IntrBkSttlmAmt": {"@Ccy": currency, "#text": f"{amount:.2f}"},
                    "Dbtr": {"Nm": sender_name},
                    "DbtrAcct": {"Id": {"IBAN": sender_iban}},
                    "CdtrAgt": {"FinInstnId": {"BICFI": receiver_bank_bic}},
                    "Cdtr": {"Nm": receiver_name},
                    "CdtrAcct": {"Id": {"IBAN": receiver_iban}},
                    "RmtInf": {"Ustrd": description},
                },
            },
        }
    }

    # Convert to XML string
    return xmltodict.unparse(pacs008_dict, pretty=True)


def parse_pacs008_xml(xml_string: str) -> dict:
    """
    Parses an incoming ISO 20022 `pacs.008.001.08` XML string into a flat dictionary
    with the key transfer details.
    """
    try:
        parsed = xmltodict.parse(xml_string)
        xfer_info = parsed["Document"]["FIToFICstmrCdtTrf"]["CdtTrfTxInf"]

        amount = float(xfer_info["IntrBkSttlmAmt"]["#text"])
        currency = xfer_info["IntrBkSttlmAmt"]["@Ccy"]
        sender_name = xfer_info["Dbtr"]["Nm"]
        sender_iban = xfer_info["DbtrAcct"]["Id"]["IBAN"]
        receiver_name = xfer_info.get("Cdtr", {}).get("Nm", "Unknown")
        receiver_iban = xfer_info["CdtrAcct"]["Id"]["IBAN"]
        description = xfer_info.get("RmtInf", {}).get("Ustrd", "Transfer")
        end_to_end_id = xfer_info["PmtId"]["EndToEndId"]

        return {
            "success": True,
            "end_to_end_id": end_to_end_id,
            "amount": amount,
            "currency": currency,
            "sender_name": sender_name,
            "sender_iban": sender_iban,
            "receiver_name": receiver_name,
            "receiver_iban": receiver_iban,
            "description": description,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_pacs002_xml(original_msg_id: str, status_code: str = "ACTC", error_details: str = "") -> str:
    """
    Generates an ISO 20022 `pacs.002.001.10` XML (Payment Status Report).
    status_code:
        ACTC = AcceptedTechnicalValidation (Success)
        RJCT = Rejected (Fail)
    """
    msg_id = generate_message_id()
    creation_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    pacs002_dict = {
        "Document": {
            "@xmlns": "urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10",
            "FIToFIPmtStsRpt": {
                "GrpHdr": {
                    "MsgId": msg_id,
                    "CreDtTm": creation_time,
                },
                "TxInfAndSts": {
                    "OrgnlGrpInfAndSts": {"OrgnlMsgId": original_msg_id},
                    "TxSts": status_code,
                },
            },
        }
    }

    if error_details and status_code == "RJCT":
        pacs002_dict["Document"]["FIToFIPmtStsRpt"]["TxInfAndSts"]["StsRsnInf"] = {"AddtlInf": error_details}

    return xmltodict.unparse(pacs002_dict, pretty=True)

def parse_pacs002_xml(xml_string: str) -> dict:
    """
    Parses an incoming ISO 20022 `pacs.002.001.10` status report.
    Returns status info (True if ACTC, False if RJCT).
    """
    try:
        parsed = xmltodict.parse(xml_string)
        report = parsed["Document"]["FIToFIPmtStsRpt"]["TxInfAndSts"]
        
        status = report["TxSts"]
        # In pacs.002, ACTC or ACCP usually mean success
        success = status in ["ACTC", "ACCP", "ACSP"]
        
        # Look for reason info if failed
        reason = ""
        if not success and "StsRsnInf" in report:
            reason = report["StsRsnInf"].get("AddtlInf", "Unknown error")
            
        return {
            "success": success,
            "status_code": status,
            "reason": reason
        }
    except Exception as e:
        return {"success": False, "error": str(e), "status_code": "ERR", "reason": "Failed to parse pacs.002"}
