"""Security awareness simulator: scenarios and choice evaluation (no DB)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/simulator", tags=["simulator"])

Locale = Literal["ru", "en"]


class ChoiceOutcome(BaseModel):
    choice_id: str
    is_safe: bool
    severity: Literal["none", "low", "medium", "critical"]
    security_delta: int = Field(description="Change to security score (-40..+25)")
    xp_delta: int = Field(description="XP change")
    teach_title: str
    teach_body: str
    show_consequences: bool
    consequence_steps: list[dict[str, str]] = Field(default_factory=list)


def _outcomes_mail(locale: Locale) -> dict[str, ChoiceOutcome]:
    if locale == "en":
        return {
            "open_link": ChoiceOutcome(
                choice_id="open_link",
                is_safe=False,
                severity="critical",
                security_delta=-35,
                xp_delta=-20,
                teach_title="Phishing link",
                teach_body=(
                    "Legitimate banks rarely ask you to 'verify urgently' via an external link. "
                    "The domain may look similar (typosquatting). Always open the app or type the bank URL yourself."
                ),
                show_consequences=True,
                consequence_steps=[
                    {"title": "Session captured", "detail": "Fake page stole your credentials."},
                    {"title": "Money transferred", "detail": "Attackers initiated outbound payments."},
                    {"title": "Data exfiltration", "detail": "Contacts and statements were scraped."},
                ],
            ),
            "delete_only": ChoiceOutcome(
                choice_id="delete_only",
                is_safe=True,
                severity="low",
                security_delta=8,
                xp_delta=6,
                teach_title="Better than clicking",
                teach_body=(
                    "Deleting reduces risk for you, but reporting helps protect colleagues. "
                    "If your org has a 'report phishing' button or SOC mailbox, use it."
                ),
                show_consequences=False,
                consequence_steps=[],
            ),
            "verify_sender": ChoiceOutcome(
                choice_id="verify_sender",
                is_safe=True,
                severity="none",
                security_delta=20,
                xp_delta=15,
                teach_title="Check the real sender",
                teach_body=(
                    "Inspect the full address and reply-to, SPF/DMARC hints, and whether the tone matches real notices. "
                    "When in doubt, call the bank via the number on your card — not from the email."
                ),
                show_consequences=False,
                consequence_steps=[],
            ),
            "report": ChoiceOutcome(
                choice_id="report",
                is_safe=True,
                severity="none",
                security_delta=25,
                xp_delta=20,
                teach_title="Best practice",
                teach_body=(
                    "Reporting trains filters and incident response. Combine with sender verification for maximum effect."
                ),
                show_consequences=False,
                consequence_steps=[],
            ),
        }
    return {
        "open_link": ChoiceOutcome(
            choice_id="open_link",
            is_safe=False,
            severity="critical",
            security_delta=-35,
            xp_delta=-20,
            teach_title="Фишинговая ссылка",
            teach_body=(
                "Банки редко просят «срочно подтвердить» по внешней ссылке. Домен может быть похож на настоящий "
                "(опечатка, другая зона). Открывайте только приложение банка или введите адрес сайта вручную."
            ),
            show_consequences=True,
            consequence_steps=[
                {"title": "Сессия перехвачена", "detail": "Поддельная страница украла логин и пароль."},
                {"title": "Списание средств", "detail": "Мошенники инициировали переводы с вашего счёта."},
                {"title": "Утечка данных", "detail": "Контакты и выписки могли быть скачаны."},
            ],
        ),
        "delete_only": ChoiceOutcome(
            choice_id="delete_only",
            is_safe=True,
            severity="low",
            security_delta=8,
            xp_delta=6,
            teach_title="Лучше, чем кликнуть",
            teach_body=(
                "Удаление снижает риск для вас, но репорт помогает защитить коллег. "
                "Если в компании есть кнопка «Сообщить о фишинге» или почта SOC — используйте её."
            ),
            show_consequences=False,
            consequence_steps=[],
        ),
        "verify_sender": ChoiceOutcome(
            choice_id="verify_sender",
            is_safe=True,
            severity="none",
            security_delta=20,
            xp_delta=15,
            teach_title="Проверьте отправителя",
            teach_body=(
                "Смотрите полный адрес, Reply-To, совпадение тона с реальными уведомлениями. "
                "При сомнении звоните в банк по номеру с карты — не из письма."
            ),
            show_consequences=False,
            consequence_steps=[],
        ),
        "report": ChoiceOutcome(
            choice_id="report",
            is_safe=True,
            severity="none",
            security_delta=25,
            xp_delta=20,
            teach_title="Лучшая практика",
            teach_body=(
                "Репорт обучает фильтры и SOC. Вместе с проверкой отправителя это максимально снижает риск."
            ),
            show_consequences=False,
            consequence_steps=[],
        ),
    }


def _outcomes_chat(locale: Locale) -> dict[str, ChoiceOutcome]:
    if locale == "en":
        return {
            "send_codes": ChoiceOutcome(
                choice_id="send_codes",
                is_safe=False,
                severity="critical",
                security_delta=-40,
                xp_delta=-25,
                teach_title="Gift-card pressure",
                teach_body=(
                    "Urgent 'boss' requests for gift cards or transfers are a classic BEC pattern. "
                    "Verify through a second channel you already trust (phone/video)."
                ),
                show_consequences=True,
                consequence_steps=[
                    {"title": "Account takeover", "detail": "SIM swap or reused password gave access to your work chat."},
                    {"title": "Funds lost", "detail": "Gift cards were cashed out; chargeback is unlikely."},
                    {"title": "Data leak", "detail": "Attackers harvested files you shared while trusting the thread."},
                ],
            ),
            "callback": ChoiceOutcome(
                choice_id="callback",
                is_safe=True,
                severity="none",
                security_delta=22,
                xp_delta=18,
                teach_title="Out-of-band verification",
                teach_body=(
                    "Calling your manager on a known number breaks the attack chain. "
                    "If they confirm, you can proceed safely."
                ),
                show_consequences=False,
                consequence_steps=[],
            ),
            "official_channel": ChoiceOutcome(
                choice_id="official_channel",
                is_safe=True,
                severity="none",
                security_delta=18,
                xp_delta=14,
                teach_title="Use official workflows",
                teach_body=(
                    "Corporate finance requests should go through ticket systems or approved tools — not random DMs."
                ),
                show_consequences=False,
                consequence_steps=[],
            ),
            "ignore": ChoiceOutcome(
                choice_id="ignore",
                is_safe=True,
                severity="low",
                security_delta=10,
                xp_delta=8,
                teach_title="Do nothing harmful",
                teach_body=(
                    "Ignoring avoids immediate damage, but a quick heads-up to IT/Security helps others who might fall for it."
                ),
                show_consequences=False,
                consequence_steps=[],
            ),
        }
    return {
        "send_codes": ChoiceOutcome(
            choice_id="send_codes",
            is_safe=False,
            severity="critical",
            security_delta=-40,
            xp_delta=-25,
            teach_title="Давление и «подарочные карты»",
            teach_body=(
                "Срочные просьбы «руководителя» купить карты или перевести деньги — типичный сценарий BEC. "
                "Проверьте вторым каналом, которому вы уже доверяете (звонок/видео на известный номер)."
            ),
            show_consequences=True,
            consequence_steps=[
                {"title": "Взлом аккаунта", "detail": "SIM-подмена или пароль дали доступ к рабочему чату."},
                {"title": "Потеря денег", "detail": "Карты обналичены, возврат маловероятен."},
                {"title": "Утечка данных", "detail": "Пока вы доверяли чату, могли украсть файлы и переписку."},
            ],
        ),
        "callback": ChoiceOutcome(
            choice_id="callback",
            is_safe=True,
            severity="none",
            security_delta=22,
            xp_delta=18,
            teach_title="Проверка вне чата",
            teach_body=(
                "Звонок руководителю на известный номер разрывает цепочку атаки. Если подтвердят — можно действовать."
            ),
            show_consequences=False,
            consequence_steps=[],
        ),
        "official_channel": ChoiceOutcome(
            choice_id="official_channel",
            is_safe=True,
            severity="none",
            security_delta=18,
            xp_delta=14,
            teach_title="Официальные процессы",
            teach_body=(
                "Финансовые запросы в компании должны идти через тикеты или утверждённые инструменты — не из личных DM."
            ),
            show_consequences=False,
            consequence_steps=[],
        ),
        "ignore": ChoiceOutcome(
            choice_id="ignore",
            is_safe=True,
            severity="low",
            security_delta=10,
            xp_delta=8,
            teach_title="Без вреда",
            teach_body=(
                "Игнор не даёт немедленного ущерба, но короткое сообщение в IT/Security защищает коллег."
            ),
            show_consequences=False,
            consequence_steps=[],
        ),
    }


def _scenario_mail(locale: Locale) -> dict:
    if locale == "en":
        return {
            "id": "phishing-mail",
            "type": "email",
            "title": "Urgent: security verification",
            "sender_display": "SecureBank Alerts",
            "sender_email": "alerts@securebank-updates.net",
            "subject": "Action required: confirm your device within 24 hours",
            "preview": "Dear customer, we detected unusual login activity...",
            "body_paragraphs": [
                "We detected a login to your online banking from an unrecognized device in Tallinn, Estonia.",
                "If this was not you, you must verify your identity immediately to prevent a hold on outgoing transfers.",
                "Use the secure link below — it expires in 24 hours.",
            ],
            "cta_label": "Verify my device",
            "cta_href_display": "https://securebank-updates.net/verify?session=7f3a…",
            "choices": [
                {"id": "open_link", "label": "Open the link"},
                {"id": "delete_only", "label": "Delete email"},
                {"id": "verify_sender", "label": "Check sender details"},
                {"id": "report", "label": "Report phishing"},
            ],
        }
    return {
        "id": "phishing-mail",
        "type": "email",
        "title": "Срочно: проверка безопасности",
        "sender_display": "SecureBank Уведомления",
        "sender_email": "alerts@securebank-updates.net",
        "subject": "Требуется действие: подтвердите устройство в течение 24 часов",
        "preview": "Уважаемый клиент, зафиксирован необычный вход...",
        "body_paragraphs": [
            "Мы зафиксировали вход в интернет-банк с незнакомого устройства (Таллин, Эстония).",
            "Если это были не вы, необходимо срочно подтвердить личность, иначе будут ограничены исходящие переводы.",
            "Используйте защищённую ссылку ниже — она действует 24 часа.",
        ],
        "cta_label": "Подтвердить устройство",
        "cta_href_display": "https://securebank-updates.net/verify?session=7f3a…",
        "choices": [
            {"id": "open_link", "label": "Открыть ссылку"},
            {"id": "delete_only", "label": "Удалить письмо"},
            {"id": "verify_sender", "label": "Проверить отправителя"},
            {"id": "report", "label": "Сообщить о фишинге"},
        ],
    }


def _scenario_chat(locale: Locale) -> dict:
    if locale == "en":
        return {
            "id": "se-telegram",
            "type": "chat",
            "title": "Work chat",
            "peer_name": "Alex — Director",
            "peer_handle": "alex_director_office",
            "messages": [
                {
                    "from": "peer",
                    "text": (
                        "Hey, I'm in back-to-back meetings. Need a quick favor — buy 4x $500 Apple gift cards "
                        "for a client incentive. Send codes here, I'll reimburse today. URGENT, don't tell finance yet."
                    ),
                    "time": "14:02",
                }
            ],
            "choices": [
                {"id": "send_codes", "label": "Send the codes now"},
                {"id": "callback", "label": "Call back on a known number"},
                {"id": "official_channel", "label": "Ask to use official procurement"},
                {"id": "ignore", "label": "Ignore for now"},
            ],
        }
    return {
        "id": "se-telegram",
        "type": "chat",
        "title": "Рабочий чат",
        "peer_name": "Алексей — директор",
        "peer_handle": "alex_director_office",
        "messages": [
            {
                "from": "peer",
                "text": (
                    "Привет, сижу на беспрерывных созвонах. Нужна срочная помощь — купи 4 подарочные карты Apple "
                    "по $500 для клиентского поощрения. Коды пришли сюда, сегодня компенсирую. СРОЧНО, финотделу пока не говори."
                ),
                "time": "14:02",
            }
        ],
        "choices": [
            {"id": "send_codes", "label": "Отправить коды сейчас"},
            {"id": "callback", "label": "Перезвонить на известный номер"},
            {"id": "official_channel", "label": "Попросить оформить через закупки"},
            {"id": "ignore", "label": "Пока не отвечать"},
        ],
    }


class SubmitChoiceBody(BaseModel):
    choice_id: str


def _locale_from_request(request: Request, lang: str | None) -> Locale:
    if lang in ("ru", "en"):
        return lang
    accept = request.headers.get("accept-language", "")
    if accept.lower().startswith("ru"):
        return "ru"
    return "en"


@router.get("/scenarios")
async def list_scenarios(
    request: Request,
    lang: str | None = Query(default=None, description="ru or en"),
) -> dict:
    locale = _locale_from_request(request, lang)
    mail = _scenario_mail(locale)
    chat = _scenario_chat(locale)
    return {
        "locale": locale,
        "scenarios": [
            {"id": mail["id"], "type": mail["type"], "title": mail["title"]},
            {"id": chat["id"], "type": chat["type"], "title": chat["title"]},
        ],
    }


@router.get("/scenarios/{scenario_id}")
async def get_scenario(
    scenario_id: str,
    request: Request,
    lang: str | None = Query(default=None),
) -> dict:
    locale = _locale_from_request(request, lang)
    if scenario_id == "phishing-mail":
        return {"locale": locale, "scenario": _scenario_mail(locale)}
    if scenario_id == "se-telegram":
        return {"locale": locale, "scenario": _scenario_chat(locale)}
    raise HTTPException(status_code=404, detail="scenario_not_found")


@router.post("/scenarios/{scenario_id}/submit")
async def submit_choice(
    scenario_id: str,
    body: SubmitChoiceBody,
    request: Request,
    lang: str | None = Query(default=None),
) -> dict:
    locale = _locale_from_request(request, lang)
    outcomes: dict[str, ChoiceOutcome]
    if scenario_id == "phishing-mail":
        outcomes = _outcomes_mail(locale)
    elif scenario_id == "se-telegram":
        outcomes = _outcomes_chat(locale)
    else:
        raise HTTPException(status_code=404, detail="scenario_not_found")

    outcome = outcomes.get(body.choice_id)
    if not outcome:
        return {"ok": False, "error": "unknown_choice", "locale": locale}

    return {
        "ok": True,
        "locale": locale,
        "result": outcome.model_dump(),
    }
