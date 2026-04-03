/** Security awareness simulator (api-gateway `/api/v1/simulator/*`). */

function apiBase(): string {
  return import.meta.env.VITE_API_BASE ?? "";
}

export type ScenarioListItem = {
  id: string;
  type: "email" | "chat";
  title: string;
};

export type ScenarioChoice = { id: string; label: string };

export type EmailScenario = {
  id: string;
  type: "email";
  title: string;
  sender_display: string;
  sender_email: string;
  subject: string;
  preview: string;
  body_paragraphs: string[];
  cta_label: string;
  cta_href_display: string;
  choices: ScenarioChoice[];
};

export type ChatScenario = {
  id: string;
  type: "chat";
  title: string;
  peer_name: string;
  peer_handle: string;
  messages: { from: "peer" | "me"; text: string; time: string }[];
  choices: ScenarioChoice[];
};

export type SubmitResult = {
  ok: boolean;
  locale?: string;
  error?: string;
  result?: {
    choice_id: string;
    is_safe: boolean;
    severity: "none" | "low" | "medium" | "critical";
    security_delta: number;
    xp_delta: number;
    teach_title: string;
    teach_body: string;
    show_consequences: boolean;
    consequence_steps: { title: string; detail: string }[];
  };
};

export async function fetchSimulatorScenarios(lang: string): Promise<{
  scenarios: ScenarioListItem[];
}> {
  const r = await fetch(
    `${apiBase()}/api/v1/simulator/scenarios?lang=${encodeURIComponent(lang)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`Сценарии: HTTP ${r.status}`);
  return r.json() as Promise<{ scenarios: ScenarioListItem[] }>;
}

export async function fetchSimulatorScenario(
  id: string,
  lang: string,
): Promise<{ scenario: EmailScenario | ChatScenario }> {
  const r = await fetch(
    `${apiBase()}/api/v1/simulator/scenarios/${encodeURIComponent(id)}?lang=${encodeURIComponent(lang)}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`Сценарий: HTTP ${r.status}`);
  const data = (await r.json()) as { error?: string; scenario?: EmailScenario | ChatScenario };
  if (data.error) throw new Error(data.error);
  if (!data.scenario) throw new Error("Пустой ответ");
  return { scenario: data.scenario };
}

export async function submitSimulatorChoice(
  scenarioId: string,
  choiceId: string,
  lang: string,
): Promise<SubmitResult> {
  const r = await fetch(
    `${apiBase()}/api/v1/simulator/scenarios/${encodeURIComponent(scenarioId)}/submit?lang=${encodeURIComponent(lang)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice_id: choiceId }),
    },
  );
  return r.json() as Promise<SubmitResult>;
}
