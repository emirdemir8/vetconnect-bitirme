import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/apiClient";
import {
  Card,
  Typography,
  Tag,
  Button,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Alert,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  SaveOutlined,
  WarningOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CaseDetail {
  id: string;
  pet_id: string;
  adr_no?: string | null;
  symptoms: string[];
  vet_notes?: string | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  risk_level?: number | null;
  risk_label?: string | null;
  serious?: boolean | null;
}

const RISK_COLORS: Record<number, string> = {
  1: "red",
  2: "red",
  3: "orange",
  4: "gold",
  5: "green",
};

export const VetCaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rerunLoading, setRerunLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();

  async function loadCase() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CaseDetail>(`/cases/${id}`);
      setCaseData(res.data);
      form.setFieldsValue({
        vet_notes: res.data.vet_notes ?? "",
        status: res.data.status ?? "open",
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to load case";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCase();
  }, [id]);

  async function handleSaveNotes() {
    if (!id || !caseData) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.put(`/cases/${id}`, {
        vet_notes: values.vet_notes || null,
        status: values.status,
      });
      setCaseData((prev) =>
        prev ? { ...prev, vet_notes: values.vet_notes, status: values.status } : null
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRerunRisk() {
    if (!id || !caseData) return;
    setRerunLoading(true);
    setError(null);
    try {
      const res = await api.put<CaseDetail>(`/cases/${id}`, {
        symptoms: caseData.symptoms.length ? caseData.symptoms : ["unknown"],
      });
      setCaseData(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Re-run failed";
      setError(msg);
    } finally {
      setRerunLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <Card>
        <Alert type="error" message={error} />
        <Button type="primary" style={{ marginTop: 16 }} onClick={() => navigate("/vet/cases")}>
          Back to Cases
        </Button>
      </Card>
    );
  }

  if (!caseData) return null;

  const riskColor = caseData.risk_level != null && RISK_COLORS[caseData.risk_level]
    ? RISK_COLORS[caseData.risk_level]
    : "default";

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/vet/cases")}>
          Back
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          Case #{caseData.id.slice(-8)}
        </Title>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={
          <Space>
            <span>Overview</span>
            <Tag color={caseData.serious ? "red" : "blue"}>
              {caseData.serious ? "Serious" : "Not serious"}
            </Tag>
            <Tag color={riskColor}>{caseData.risk_label ?? "Unclear"}</Tag>
          </Space>
        }
        style={{ marginBottom: 16, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 20 }}
      >
        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <div>
            <Text type="secondary">Pet ID: </Text>
            <Text strong>{caseData.pet_id}</Text>
          </div>
          {caseData.adr_no && (
            <div>
              <Text type="secondary">ADR No: </Text>
              <Text>{caseData.adr_no}</Text>
            </div>
          )}
          <div>
            <Text type="secondary">Created: </Text>
            <Text>
              {caseData.created_at
                ? new Date(caseData.created_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </Text>
          </div>
        </div>

        <Divider style={{ margin: "12px 0" }} />

        <Title level={5}>
          <WarningOutlined style={{ marginRight: 8 }} />
          Symptoms
        </Title>
        <div style={{ marginBottom: 16 }}>
          {caseData.symptoms.length ? (
            <Space wrap size={[8, 8]}>
              {caseData.symptoms.map((s, i) => (
                <Tag key={i} color="blue">
                  {s}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">No symptoms recorded.</Text>
          )}
        </div>

        <div style={{ marginBottom: 8 }}>
          <Text strong>Risk level: </Text>
          <Tag color={riskColor}>
            {caseData.risk_label ?? `Level ${caseData.risk_level ?? "—"}`}
          </Tag>
        </div>

        <Button
          type="default"
          icon={<ReloadOutlined spin={rerunLoading} />}
          onClick={handleRerunRisk}
          loading={rerunLoading}
          style={{ marginTop: 8 }}
        >
          Re-run risk analysis
        </Button>
      </Card>

      <Card
        title="Vet notes and status"
        style={{ borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 20 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="Status">
            <Select
              options={[
                { value: "open", label: "Open" },
                { value: "in_review", label: "In review" },
                { value: "closed", label: "Closed" },
              ]}
              style={{ maxWidth: 200 }}
            />
          </Form.Item>
          <Form.Item name="vet_notes" label="Vet notes / treatment plan">
            <TextArea rows={5} placeholder="Examination findings, treatment, follow-up..." maxLength={4000} showCount />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveNotes} loading={saving}>
              Save notes
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
