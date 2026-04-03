export const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000")
    : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000");

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

export async function fetchScenarios(lang: string): Promise<{
  scenarios: ScenarioListItem[];
}> {
  const r = await fetch(`${API_BASE}/api/v1/simulator/scenarios?lang=${lang}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`scenarios ${r.status}`);
  return r.json();
}

export async function fetchScenario(
  id: string,
  lang: string,
): Promise<{ scenario: EmailScenario | ChatScenario }> {
  const r = await fetch(
    `${API_BASE}/api/v1/simulator/scenarios/${id}?lang=${lang}`,
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error(`scenario ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function submitChoice(
  scenarioId: string,
  choiceId: string,
  lang: string,
): Promise<SubmitResult> {
  const r = await fetch(
    `${API_BASE}/api/v1/simulator/scenarios/${scenarioId}/submit?lang=${lang}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice_id: choiceId }),
    },
  );
  return r.json();
}
