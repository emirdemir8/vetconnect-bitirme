import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card, Typography, Select, Input, Button, Alert, Tag, Form } from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Pet {
  id: string;
  name: string;
  species: string;
}

interface VaccineType {
  id: string;
  name: string;
}

interface SymptomOpt {
  value: string;
  label: string;
}

interface CheckRequest {
  animal_species?: string | null;
  product_or_vaccine?: string | null;
  symptoms: string[];
  free_text?: string | null;
  adr_no: string | null;
  include_owner_guidance?: boolean;
  pet_name?: string | null;
}

interface CheckResponse {
  serious: boolean;
  risk_level: number | null;
  risk_label: string | null;
  matched_symptoms: string[];
  matched_records: number;
  reasons: string[];
  inferred_symptoms?: string[];
  owner_guidance?: string | null;
  owner_guidance_source?: string | null;
}

interface ReportPayload {
  pet_id: string;
  animal_species: string | null;
  product_or_vaccine: string | null;
  symptoms: string[];
  free_text: string | null;
  adr_no: string | null;
  system_serious: boolean;
  system_risk_level: number | null;
  system_risk_label: string | null;
  system_reasons: string[];
  system_inferred_symptoms: string[];
  system_matched_symptoms: string[];
  system_matched_records: number;
  owner_guidance: string | null;
  owner_guidance_source: string | null;
}

const OTHER_PRODUCT_ID = "other";

const RISK_UI: Record<
  number,
  { border: string; bg: string; icon: React.ReactNode; title: string; summary: string }
> = {
  1: {
    border: "#fca5a5",
    bg: "#fef2f2",
    icon: <ExclamationCircleOutlined style={{ color: "#dc2626", fontSize: 22 }} />,
    title: "Urgent — contact your vet now",
    summary: "Critical symptoms were reported (e.g. death or severe signs).",
  },
  2: {
    border: "#fdba74",
    bg: "#fff7ed",
    icon: <ExclamationCircleOutlined style={{ color: "#ea580c", fontSize: 22 }} />,
    title: "Call your veterinarian today",
    summary: "Worth a prompt check-up based on what you reported.",
  },
  3: {
    border: "#fcd34d",
    bg: "#fffbeb",
    icon: <InfoCircleOutlined style={{ color: "#d97706", fontSize: 22 }} />,
    title: "Plan a vet visit",
    summary: "Moderate concern — monitor closely over the next day or two.",
  },
  4: {
    border: "#fde047",
    bg: "#fefce8",
    icon: <InfoCircleOutlined style={{ color: "#ca8a04", fontSize: 22 }} />,
    title: "Keep watching",
    summary: "Lower–moderate concern. Watch for any worsening signs.",
  },
  5: {
    border: "#86efac",
    bg: "#f0fdf4",
    icon: <CheckCircleOutlined style={{ color: "#16a34a", fontSize: 22 }} />,
    title: "Lower concern",
    summary: "Milder pattern in our comparison — still contact your vet if unsure.",
  },
};

const NEXT_STEPS: Record<number, string[]> = {
  1: [
    "Contact your veterinarian immediately.",
    "Go to emergency care if your pet is in distress or you reported critical signs.",
  ],
  2: [
    "Book a vet appointment today if symptoms continue.",
    "Do not give medication without your vet’s approval.",
  ],
  3: [
    "Arrange a visit within 24–48 hours if symptoms persist.",
    "Track appetite, energy, and drinking daily.",
  ],
  4: [
    "Watch for 24–48 hours; call your vet if things worsen.",
    "Note appetite, energy, and stool quality.",
  ],
  5: [
    "Monitor at home; contact your vet if symptoms continue.",
    "Your report is saved for your veterinarian to review.",
  ],
};

function shortRiskLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^Level \d+:\s*/i, "")
    .replace(/\s*\(approx\.[^)]+\)\.?/i, "")
    .replace(/\.$/, "")
    .trim();
}

export const OwnerCheck: React.FC = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState("");
  const [productChoiceId, setProductChoiceId] = useState("");
  const [customProduct, setCustomProduct] = useState("");
  const [vaccineCatalog, setVaccineCatalog] = useState<VaccineType[]>([]);
  const [symptomOptions, setSymptomOptions] = useState<SymptomOpt[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomNarrative, setSymptomNarrative] = useState("");
  const [adrNo, setAdrNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPetObj = pets.find((p) => p.id === selectedPet);
  const showResults = Boolean(result);

  useEffect(() => {
    api
      .get<Pet[]>("/pets")
      .then((res) => {
        setPets(res.data);
        if (res.data.length) setSelectedPet(res.data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ items: VaccineType[] }>("/vaccine-types"),
      api.get<{ items: SymptomOpt[] }>("/vet/symptom-options?limit=2000"),
    ])
      .then(([vRes, sRes]) => {
        if (!cancelled) {
          setVaccineCatalog(vRes.data.items || []);
          setSymptomOptions(sRes.data.items || []);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load form options. Please refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogProducts = useMemo(
    () => vaccineCatalog.filter((v) => v.id !== OTHER_PRODUCT_ID),
    [vaccineCatalog],
  );

  const productSelectOptions = useMemo(
    () => [
      ...catalogProducts.map((v) => ({ value: v.id, label: v.name })),
      { value: OTHER_PRODUCT_ID, label: "Other…" },
    ],
    [catalogProducts],
  );

  function resolveProductName(): string | null {
    if (!productChoiceId) return null;
    if (productChoiceId === OTHER_PRODUCT_ID) return customProduct.trim() || null;
    return catalogProducts.find((v) => v.id === productChoiceId)?.name.trim() || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setReportSaved(false);

    const narrative = symptomNarrative.trim() || null;

    if (!selectedPet) {
      setError("Select a pet.");
      return;
    }
    if (!productChoiceId) {
      setError("Select a vaccine or product.");
      return;
    }
    if (productChoiceId === OTHER_PRODUCT_ID && !customProduct.trim()) {
      setError("Enter the product name.");
      return;
    }
    if (!selectedSymptoms.length && !narrative) {
      setError("Add at least one symptom or a short description.");
      return;
    }

    const productName = resolveProductName();
    const payload: CheckRequest = {
      animal_species: selectedPetObj?.species?.trim() || null,
      product_or_vaccine: productName,
      symptoms: selectedSymptoms,
      free_text: narrative,
      adr_no: adrNo.trim() || null,
      include_owner_guidance: true,
      pet_name: selectedPetObj?.name?.trim() || null,
    };

    setLoading(true);
    try {
      const res = await api.post<CheckResponse>("/vet/check-serious", payload);
      setResult(res.data);
      await api.post("/symptom-reports", {
        pet_id: selectedPet,
        animal_species: selectedPetObj?.species?.trim() || null,
        product_or_vaccine: productName,
        symptoms: res.data.matched_symptoms?.length ? res.data.matched_symptoms : selectedSymptoms,
        free_text: narrative,
        adr_no: adrNo.trim() || null,
        system_serious: res.data.serious,
        system_risk_level: res.data.risk_level ?? null,
        system_risk_label: res.data.risk_label ?? null,
        system_reasons: res.data.reasons || [],
        system_inferred_symptoms: res.data.inferred_symptoms || [],
        system_matched_symptoms: res.data.matched_symptoms || [],
        system_matched_records: res.data.matched_records || 0,
        owner_guidance: res.data.owner_guidance ?? null,
        owner_guidance_source: res.data.owner_guidance_source ?? null,
      } satisfies ReportPayload);
      setReportSaved(true);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Pre-check failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function renderResultPanel() {
    if (!result) return null;

    const lvl = result.risk_level ?? 5;
    const ui = RISK_UI[lvl] || RISK_UI[5];
    const petLabel = selectedPetObj?.name || "Your pet";
    const steps = NEXT_STEPS[lvl] || NEXT_STEPS[5];
    const inferred = (result.inferred_symptoms || []).filter((s) => !selectedSymptoms.includes(s));
    const detail = shortRiskLabel(result.risk_label);

    return (
      <Card
        style={{
          marginTop: 20,
          borderRadius: 12,
          border: `1px solid ${ui.border}`,
          background: ui.bg,
        }}
        bodyStyle={{ padding: "18px 20px" }}
      >
        <div>
          {reportSaved && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Saved ·{" "}
              <Link to="/owner/history" style={{ fontSize: 12 }}>
                View in History
              </Link>
            </Text>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: reportSaved ? 10 : 0 }}>
            {ui.icon}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text strong style={{ fontSize: 16 }}>
                {petLabel} — {ui.title}
              </Text>
              <Text type="secondary" style={{ display: "block", marginTop: 4, fontSize: 13 }}>
                {ui.summary}
                {detail ? ` · ${detail}` : ""}
              </Text>
            </div>
          </div>

          {(result.matched_symptoms?.length ?? 0) > 0 && (
            <div style={{ marginTop: 14 }}>
              {(result.matched_symptoms || []).slice(0, 8).map((s) => (
                <Tag key={s} style={{ marginBottom: 6 }}>
                  {s}
                </Tag>
              ))}
              {inferred.length > 0 && (
                <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                  Also matched from your note: {inferred.slice(0, 4).join(", ")}
                </Text>
              )}
            </div>
          )}

          <ul
            style={{
              margin: "14px 0 0",
              paddingLeft: 18,
              color: "#374151",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            {steps.map((step) => (
              <li key={step} style={{ marginBottom: 4 }}>
                {step}
              </li>
            ))}
          </ul>

          <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 12 }}>
            Pre-check only — not a diagnosis. Follow your veterinarian’s advice.
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "24px auto", padding: "0 16px" }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        Symptom report
      </Title>
      <Text type="secondary">Quick pre-check for your vet.</Text>

      {!showResults && (
        <Card style={{ marginTop: 20, borderRadius: 12 }} bodyStyle={{ padding: "20px 20px 8px" }}>
          <Form layout="vertical" component={false}>
            <form onSubmit={handleSubmit} noValidate>
              <Form.Item label="Pet" style={{ marginBottom: 16 }}>
                <Select
                  value={selectedPet || undefined}
                  onChange={setSelectedPet}
                  options={pets.map((p) => ({
                    label: `${p.name} (${p.species})`,
                    value: p.id,
                  }))}
                  placeholder="Select pet"
                />
              </Form.Item>

              <Form.Item label="Vaccine or product" style={{ marginBottom: 16 }}>
                <Select
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder="Search catalog or choose Other"
                  value={productChoiceId || undefined}
                  onChange={(id) => {
                    setProductChoiceId(id);
                    if (id !== OTHER_PRODUCT_ID) setCustomProduct("");
                  }}
                  options={productSelectOptions}
                  listHeight={240}
                  filterOption={(input, option) => {
                    if (option?.value === OTHER_PRODUCT_ID) return true;
                    return String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase());
                  }}
                />
                {productChoiceId === OTHER_PRODUCT_ID && (
                  <Input
                    style={{ marginTop: 8 }}
                    value={customProduct}
                    onChange={(e) => setCustomProduct(e.target.value)}
                    placeholder="Product name"
                  />
                )}
              </Form.Item>

              <Form.Item label="Symptoms" style={{ marginBottom: 16 }}>
                <Select
                  mode="multiple"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Search and select"
                  value={selectedSymptoms}
                  onChange={setSelectedSymptoms}
                  options={symptomOptions}
                  maxTagCount="responsive"
                  listHeight={280}
                />
              </Form.Item>

              <Form.Item label="Notes (optional)" style={{ marginBottom: 16 }}>
                <TextArea
                  rows={2}
                  value={symptomNarrative}
                  onChange={(e) => setSymptomNarrative(e.target.value)}
                  placeholder="Optional — describe in your own words"
                />
              </Form.Item>

              <Form.Item label="ADR number (optional)" style={{ marginBottom: 16 }}>
                <Input
                  value={adrNo}
                  onChange={(e) => setAdrNo(e.target.value)}
                  placeholder="Optional"
                />
              </Form.Item>

              {error && (
                <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
              )}

              <Form.Item style={{ marginBottom: 12 }}>
                <Button
                  htmlType="submit"
                  type="primary"
                  block
                  size="large"
                  loading={loading}
                  disabled={!pets.length}
                >
                  Run pre-check
                </Button>
              </Form.Item>
            </form>
          </Form>
        </Card>
      )}

      {showResults && (
        <>
          {renderResultPanel()}
          <Button
            style={{ marginTop: 16 }}
            onClick={() => {
              setResult(null);
              setReportSaved(false);
            }}
          >
            New report
          </Button>
        </>
      )}
    </div>
  );
};
