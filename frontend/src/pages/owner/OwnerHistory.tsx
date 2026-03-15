import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card, Table, Tag, Typography, Alert, Divider } from "antd";
import { MessageOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface Case {
  id: string;
  pet_id: string;
  symptoms: string[];
  risk_level?: number | null;
  risk_label?: string | null;
  serious?: boolean | null;
  status: string;
}

interface SymptomReport {
  id: string;
  pet_id: string;
  free_text?: string | null;
  symptoms: string[];
  system_risk_level: number | null;
  system_risk_label: string | null;
  system_serious: boolean;
  created_at: string | null;
  vet_feedback: string | null;
}

interface Pet {
  id: string;
  name: string;
  species: string;
}

export const OwnerHistory: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [reports, setReports] = useState<SymptomReport[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);

  function petName(petId: string) {
    const p = pets.find((x) => x.id === petId);
    return p ? `${p.name} (${p.species})` : `#${String(petId).slice(-8)}`;
  }

  async function loadCases() {
    setLoading(true);
    try {
      const res = await api.get<Case[]>("/cases?limit=50");
      setCases(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    setReportsLoading(true);
    try {
      const res = await api.get<SymptomReport[]>("/symptom-reports?limit=50");
      setReports(res.data);
    } finally {
      setReportsLoading(false);
    }
  }

  async function loadPets() {
    try {
      const res = await api.get<Pet[]>("/pets");
      setPets(res.data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadPets();
    loadCases();
    loadReports();
  }, []);

  const columns = [
    {
      title: "Case",
      dataIndex: "id",
      key: "id",
      render: (id: string) => <Text>#{id.slice(-6)}</Text>,
    },
    {
      title: "Pet",
      dataIndex: "pet_id",
      key: "pet_id",
      render: (pid: string) => <Text>{petName(pid)}</Text>,
    },
    {
      title: "Risk",
      key: "risk",
      render: (_: unknown, c: Case) => (
        <Tag color={c.serious ? "red" : "blue"}>
          {c.risk_label ?? "Unclear"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
    },
    {
      title: "Symptoms",
      dataIndex: "symptoms",
      key: "symptoms",
      render: (s: string[]) => s?.slice(0, 3).join(", ") ?? "—",
    },
  ];

  return (
    <>
      <Title level={3} style={{ marginBottom: 4 }}>
        History / My Requests
      </Title>
      <Text type="secondary">
        Cases opened by your vet and your symptom reports. Vet feedback appears on the report cards.
      </Text>

      <Title level={5} style={{ marginTop: 24, marginBottom: 8 }}>
        <MessageOutlined /> My symptom reports
      </Title>
      <Card
        style={{ marginBottom: 24, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 16 }}
        loading={reportsLoading}
      >
        {reports.length === 0 && !reportsLoading && (
          <Text type="secondary">No symptom reports yet. You can run a pre-check from the Report Symptom page.</Text>
        )}
        {reports.map((r) => (
          <Card
            key={r.id}
            size="small"
            style={{ marginBottom: 12, borderRadius: 8 }}
            bodyStyle={{ padding: 12 }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Tag color={r.system_serious ? "red" : "green"}>
                {r.system_risk_label ?? (r.system_serious ? "Serious" : "Not serious")}
              </Tag>
              <Text strong style={{ fontSize: 13 }}>{petName(r.pet_id)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.created_at ? new Date(r.created_at).toLocaleString("en-GB") : ""}
              </Text>
            </div>
            {((r.free_text && r.free_text.length > 0) || (r.symptoms && r.symptoms.length > 0)) && (
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                {r.free_text || r.symptoms?.join(", ")}
              </Text>
            )}
            {r.vet_feedback && (
              <>
                <Divider style={{ margin: "8px 0" }} />
                <Alert
                  type="info"
                  message="Vet feedback"
                  description={r.vet_feedback}
                  showIcon
                  icon={<MessageOutlined />}
                />
              </>
            )}
          </Card>
        ))}
      </Card>

      <Title level={5} style={{ marginBottom: 8 }}>Cases (requests)</Title>
      <Card
        style={{ marginTop: 8, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 16 }}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={cases}
          columns={columns}
          size="middle"
        />
      </Card>
    </>
  );
};