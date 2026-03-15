import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Card,
  List,
  Typography,
  Tag,
  Input,
  Button,
  Space,
  Alert,
  Collapse,
  Divider,
} from "antd";
import { MessageOutlined, UserOutlined, TeamOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface SymptomReport {
  id: string;
  owner_id: string;
  pet_id: string;
  pet_name?: string | null;
  owner_name?: string | null;
  animal_species?: string | null;
  product_or_vaccine?: string | null;
  symptoms: string[];
  free_text?: string | null;
  system_serious: boolean;
  system_risk_level: number | null;
  system_risk_label: string | null;
  system_reasons: string[];
  system_inferred_symptoms: string[];
  system_matched_symptoms: string[];
  system_matched_records: number;
  created_at: string | null;
  vet_feedback: string | null;
  vet_feedback_at: string | null;
}

const riskColor: Record<number, string> = {
  1: "red",
  2: "orange",
  3: "gold",
  4: "blue",
  5: "green",
};

export const VetReports: React.FC = () => {
  const [reports, setReports] = useState<SymptomReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  async function loadReports() {
    setLoading(true);
    try {
      const res = await api.get<SymptomReport[]>("/symptom-reports?limit=100");
      setReports(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function submitFeedback(reportId: string) {
    const text = feedback[reportId]?.trim();
    if (!text) return;
    setSubmitting((s) => ({ ...s, [reportId]: true }));
    try {
      await api.patch(`/symptom-reports/${reportId}`, { vet_feedback: text });
      setFeedback((f) => ({ ...f, [reportId]: "" }));
      loadReports();
    } finally {
      setSubmitting((s) => ({ ...s, [reportId]: false }));
    }
  }

  return (
    <>
      <Title level={3} style={{ marginBottom: 4 }}>
        Symptom Reports
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Owner-reported symptoms, system response based on the dataset, and your vet feedback.
      </Text>

      <List
        loading={loading}
        dataSource={reports}
        renderItem={(r) => (
          <Card
            key={r.id}
            size="small"
            style={{ marginBottom: 16, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
            bodyStyle={{ padding: 16 }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Space>
                <Tag icon={<TeamOutlined />} color="blue">
                  {r.pet_name || "Pet"} {r.animal_species && `(${r.animal_species})`}
                </Tag>
                {r.owner_name && (
                  <Tag icon={<UserOutlined />}>{r.owner_name}</Tag>
                )}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.created_at ? new Date(r.created_at).toLocaleString("en-GB") : ""}
              </Text>
              <Tag color={r.system_serious ? "red" : "green"}>
                {r.system_serious ? "Serious" : "Not serious"}
              </Tag>
              {r.system_risk_level != null && (
                <Tag color={riskColor[r.system_risk_level] || "default"}>
                  Level {r.system_risk_level}
                </Tag>
              )}
            </div>

            <Collapse
              ghost
              items={[
                {
                  key: "detail",
                  label: "Owner input and system response",
                  children: (
                    <>
                      {r.product_or_vaccine && (
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>Product/Vaccine: </Text>
                          <Text>{r.product_or_vaccine}</Text>
                        </div>
                      )}
                      {r.free_text && (
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>Free text: </Text>
                          <div style={{ background: "#f5f5f5", padding: 8, borderRadius: 8, marginTop: 4 }}>
                            {r.free_text}
                          </div>
                        </div>
                      )}
                      {r.symptoms.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>Symptoms: </Text>
                          <Text>{r.symptoms.join(", ")}</Text>
                        </div>
                      )}
                      <Divider style={{ margin: "8px 0" }} />
                      <Text strong>System response (dataset-based)</Text>
                      <div style={{ marginTop: 8 }}>
                        {r.system_risk_label && (
                          <div style={{ marginBottom: 4 }}>
                            <Tag color={riskColor[r.system_risk_level || 0] || "default"}>
                              {r.system_risk_label}
                            </Tag>
                          </div>
                        )}
                        {r.system_reasons.length > 0 && (
                          <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
                            {r.system_reasons.map((reason, i) => (
                              <li key={i}>
                                <Text type="secondary" style={{ fontSize: 12 }}>{reason}</Text>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(r.system_inferred_symptoms?.length > 0 || r.system_matched_symptoms?.length > 0) && (
                          <div style={{ marginTop: 8, fontSize: 12 }}>
                            <Text type="secondary">
                              Inferred: {[...(r.system_inferred_symptoms || []), ...(r.system_matched_symptoms || [])].join(", ") || "—"}
                            </Text>
                          </div>
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Matching records: {r.system_matched_records}
                        </Text>
                      </div>
                    </>
                  ),
                },
              ]}
            />

            <Divider style={{ margin: "12px 0" }} />

            <div style={{ marginTop: 12 }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                <MessageOutlined /> Vet feedback
              </Text>
              {r.vet_feedback && (
                <Alert
                  type="info"
                  message={r.vet_feedback}
                  style={{ marginBottom: 8 }}
                  showIcon
                />
              )}
              <Space.Compact style={{ width: "100%", maxWidth: 560 }}>
                <TextArea
                  placeholder="Write feedback to send to the owner..."
                  value={feedback[r.id] ?? ""}
                  onChange={(e) => setFeedback((f) => ({ ...f, [r.id]: e.target.value }))}
                  rows={2}
                  maxLength={2000}
                  showCount
                />
                <Button
                  type="primary"
                  loading={submitting[r.id]}
                  onClick={() => submitFeedback(r.id)}
                  disabled={!feedback[r.id]?.trim()}
                >
                  Send
                </Button>
              </Space.Compact>
            </div>
          </Card>
        )}
        locale={{ emptyText: "No symptom reports yet." }}
      />
    </>
  );
};
