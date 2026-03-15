import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card, Typography, Select, Input, Button, Alert } from "antd";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Pet {
  id: string;
  name: string;
  species: string;
}

interface CheckRequest {
  animal_species?: string | null;
  product_or_vaccine?: string | null;
  symptoms: string[];
  free_text?: string | null;
  adr_no: string | null;
}

interface CheckResponse {
  serious: boolean;
  risk_level: number | null;
  risk_label: string | null;
  matched_symptoms: string[];
  matched_records: number;
  reasons: string[];
  inferred_symptoms?: string[];
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
}

export const OwnerCheck: React.FC = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<string>("");
  const [productOrVaccine, setProductOrVaccine] = useState("");
  const [symptomInput, setSymptomInput] = useState("");
  const [freeText, setFreeText] = useState("");
  const [adrNo, setAdrNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPets() {
      try {
        const res = await api.get<Pet[]>("/pets");
        setPets(res.data);
        if (res.data.length) setSelectedPet(res.data[0].id);
      } catch {
        // sessiz geç
      }
    }
    loadPets();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const symptoms = symptomInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const free = freeText.trim() || null;

    if (!selectedPet) {
      setError("Lütfen bir evcil hayvan seçin.");
      return;
    }
    if (!symptoms.length && !free) {
      setError("Lütfen semptomları (virgülle ayrılmış) veya serbest metin girin.");
      return;
    }

    const selected = pets.find((p) => p.id === selectedPet);
    const payload: CheckRequest = {
      animal_species: selected?.species?.trim() || null,
      product_or_vaccine: productOrVaccine.trim() || null,
      symptoms,
      free_text: free,
      adr_no: adrNo.trim() || null,
    };

    setLoading(true);
    setReportSaved(false);
    try {
      const res = await api.post<CheckResponse>("/vet/check-serious", payload);
      setResult(res.data);
      const reportPayload: ReportPayload = {
        pet_id: selectedPet,
        animal_species: selected?.species?.trim() || null,
        product_or_vaccine: productOrVaccine.trim() || null,
        symptoms,
        free_text: free || null,
        adr_no: adrNo.trim() || null,
        system_serious: res.data.serious,
        system_risk_level: res.data.risk_level ?? null,
        system_risk_label: res.data.risk_label ?? null,
        system_reasons: res.data.reasons || [],
        system_inferred_symptoms: res.data.inferred_symptoms || [],
        system_matched_symptoms: res.data.matched_symptoms || [],
        system_matched_records: res.data.matched_records || 0,
      };
      await api.post("/symptom-reports", reportPayload);
      setReportSaved(true);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "An error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  }

  function renderMessage() {
    if (!result) return null;
    const lvl = result.risk_level;

    // Plain-language messages (sade dil) as per plan
    if (lvl === 1 || lvl === 2) {
      return (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          message={`Critical risk (Level ${lvl})`}
          description="The system has assessed this as high/serious risk. Please contact your vet as soon as possible."
        />
      );
    }

    if (lvl === 3 || lvl === 4) {
      return (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          message={`Moderate / high risk (Level ${lvl})`}
          description={`The system has assessed this as Level ${lvl}. It is recommended to contact your vet as soon as possible.`}
        />
      );
    }

    return (
      <Alert
        type="success"
        showIcon
        style={{ marginTop: 16 }}
        message="Low risk / unclear"
        description="The system has assessed this as low risk or unclear. If symptoms persist, consult your vet."
      />
    );
  }

  return (
    <Card
      style={{ maxWidth: 720, margin: "24px auto", borderRadius: 16 }}
      bodyStyle={{ padding: 20 }}
    >
      <Title level={3} style={{ marginBottom: 4 }}>
        Report Symptom / Pre-check
      </Title>
      <Text type="secondary">
        Select your pet, then enter symptoms or free text. The system will run a pre-risk assessment based on the
        TigressADR dataset and show the result in plain language.
      </Text>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong>Pet (species is used automatically)</Text>
          <Select
            style={{ width: "100%", marginTop: 4 }}
            value={selectedPet}
            onChange={setSelectedPet}
            options={pets.map((p) => ({
              label: `${p.name} (${p.species})`,
              value: p.id,
            }))}
            placeholder="Select pet"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Text strong>Which vaccine / medication? (suspected product)</Text>
          <Input
            style={{ marginTop: 4 }}
            value={productOrVaccine}
            onChange={(e) => setProductOrVaccine(e.target.value)}
            placeholder="e.g. Tigress, rabies vaccine"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Text strong>
            Free text / comment{" "}
            <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 12 }}>
              (e.g. We have frequent vomiting in my cat)
            </span>
          </Text>
          <TextArea
            style={{ marginTop: 4 }}
            rows={3}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="e.g. We have frequent vomiting in my cat"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Text strong>
            Symptoms (optional, comma-separated)
          </Text>
          <TextArea
            style={{ marginTop: 4 }}
            rows={2}
            value={symptomInput}
            onChange={(e) => setSymptomInput(e.target.value)}
            placeholder="e.g. vomiting, lethargy, diarrhoea"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <Text strong>ADR No (if any)</Text>
          <Input
            style={{ marginTop: 4 }}
            value={adrNo}
            onChange={(e) => setAdrNo(e.target.value)}
            placeholder="Optional"
          />
        </div>

        {error && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message={error}
          />
        )}

        <Button
          htmlType="submit"
          type="primary"
          loading={loading}
          disabled={!pets.length}
        >
          Submit for pre-check
        </Button>
      </form>

      {reportSaved && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="Report saved"
          description="Your vet can view this report and add feedback. You can track it from the History page."
        />
      )}
      {renderMessage()}
    </Card>
  );
};