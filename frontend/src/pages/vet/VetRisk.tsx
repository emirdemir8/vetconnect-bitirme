import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Typography,
  Alert,
  Tag,
  Row,
  Col,
} from "antd";
import { ExperimentOutlined, BulbOutlined } from "@ant-design/icons";

const { Text } = Typography;
const { TextArea } = Input;

interface RiskLevelDef {
  id: string;
  label: string;
  terms: string[];
}

interface RiskTermsResponse {
  levels: RiskLevelDef[];
  serious_levels: string[];
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

const badgeColorByLevel: Record<number, string> = {
  1: "red",
  2: "red",
  3: "orange",
  4: "gold",
  5: "green",
};

export const VetRisk: React.FC = () => {
  const [riskInfo, setRiskInfo] = useState<RiskTermsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    async function loadTerms() {
      try {
        const res = await api.get<RiskTermsResponse>("/vet/risk-terms");
        setRiskInfo(res.data);
      } catch {
        // ignore
      }
    }
    loadTerms();
  }, []);

  async function handleAnalyze(values: {
    animal_species?: string;
    product_or_vaccine?: string;
    symptoms?: string[];
    free_text?: string;
    adr_no?: string;
  }) {
    setError(null);
    setResult(null);
    const symptoms = (values.symptoms || []).filter(Boolean);
    const free = (values.free_text || "").trim() || null;
    if (!symptoms.length && !free) {
      setError("Enter at least one symptom (add tags or type in free text).");
      return;
    }
    const payload: CheckRequest = {
      animal_species: (values.animal_species || "").trim() || null,
      product_or_vaccine: (values.product_or_vaccine || "").trim() || null,
      symptoms,
      free_text: free,
      adr_no: (values.adr_no || "").trim() || null,
    };
    setLoading(true);
    try {
      const res = await api.post<CheckResponse>("/vet/check-serious", payload);
      setResult(res.data);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "An error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Row gutter={[24, 24]} style={{ alignItems: "flex-start" }}>
      <Col xs={24} lg={14}>
        <Card
          title={
            <span>
              <ExperimentOutlined style={{ marginRight: 8 }} />
              Risk Analysis
            </span>
          }
          style={{ borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          bodyStyle={{ padding: 24 }}
        >
          <Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
            Enter animal type and vaccine/medication (if any), then add symptoms as tags or free text. Analysis is based on the TigressADR dataset.
          </Text>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleAnalyze}
            initialValues={{ symptoms: [] }}
          >
            <Form.Item name="animal_species" label="Animal type">
              <Input placeholder="e.g. cat, dog" />
            </Form.Item>
            <Form.Item name="product_or_vaccine" label="Vaccine / medication (if any)">
              <Input placeholder="e.g. Tigress, rabies vaccine" />
            </Form.Item>
            <Form.Item
              name="symptoms"
              label="Symptoms"
              extra="Add as tags (press Enter) or use free text below."
            >
              <Select
                mode="tags"
                placeholder="e.g. vomiting, diarrhoea, lethargy"
                tokenSeparators={[","]}
                style={{ width: "100%" }}
                maxTagCount={20}
              />
            </Form.Item>
            <Form.Item name="free_text" label="Free text (optional)">
              <TextArea
                rows={3}
                placeholder="e.g. Frequent vomiting after vaccine"
              />
            </Form.Item>
            <Form.Item name="adr_no" label="ADR No (optional)">
              <Input placeholder="e.g. 12345" />
            </Form.Item>

            {error && (
              <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
            )}

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} size="large">
                {loading ? "Analyzing…" : "Analyze"}
              </Button>
            </Form.Item>
          </Form>

          <Card
            size="small"
            title="Result"
            style={{ marginTop: 24, background: "#f8fafc", borderRadius: 10 }}
            bodyStyle={{ padding: 16 }}
          >
            {!result ? (
              <Text type="secondary">Run analysis to see results.</Text>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Text strong>Risk: </Text>
                  <Tag color={result.risk_level != null ? badgeColorByLevel[result.risk_level] ?? "default" : "default"}>
                    {result.risk_label ?? (result.serious ? "Serious" : "Not serious / unclear")}
                  </Tag>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">Level: </Text>
                  <Text>{result.risk_level ?? "—"}</Text>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">Matching records: </Text>
                  <Text>{result.matched_records}</Text>
                </div>
                {result.matched_symptoms.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">Matched symptoms: </Text>
                    {result.matched_symptoms.map((s, i) => (
                      <Tag key={i} color="blue" style={{ marginTop: 4 }}>{s}</Tag>
                    ))}
                  </div>
                )}
                {result.inferred_symptoms && result.inferred_symptoms.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">Inferred from text: </Text>
                    {result.inferred_symptoms.map((s, i) => (
                      <Tag key={i} color="cyan" style={{ marginTop: 4 }}>{s}</Tag>
                    ))}
                  </div>
                )}
                {result.reasons.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>Reasons:</Text>
                    <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                      {result.reasons.map((r, i) => (
                        <li key={i}><Text type="secondary">{r}</Text></li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Card>
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Card
          title={
            <span>
              <BulbOutlined style={{ marginRight: 8 }} />
              Risk levels
            </span>
          }
          style={{
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            maxHeight: "85vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          bodyStyle={{ padding: 16, overflowY: "auto", flex: 1 }}
        >
          {!riskInfo ? (
            <Text type="secondary">Loading…</Text>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {riskInfo.levels.map((lvl) => (
                <div
                  key={lvl.id}
                  style={{
                    paddingBottom: 12,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <Text strong style={{ display: "block", marginBottom: 6 }}>
                    {lvl.label ?? lvl.id}
                  </Text>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    {lvl.terms.length ? (
                      lvl.terms.map((t, i) => (
                        <Tag key={i} style={{ margin: 0 }}>{t}</Tag>
                      ))
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
};
