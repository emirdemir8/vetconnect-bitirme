import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card, Table, Tag, Typography, Select, Space, Button, Input } from "antd";
import { Link } from "react-router-dom";
import { SearchOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface CaseRecord {
  id: string;
  pet_id: string;
  symptoms: string[];
  status: string;
  risk_level?: number | null;
  risk_label?: string | null;
  serious?: boolean | null;
  created_at?: string | null;
}

interface SymptomReportRecord {
  id: string;
  pet_id: string;
  pet_name?: string | null;
  owner_name?: string | null;
  product_or_vaccine?: string | null;
  symptoms: string[];
  free_text?: string | null;
  system_serious: boolean;
  system_risk_level: number | null;
  system_risk_label: string | null;
  created_at: string | null;
}

type RowKind = "case" | "report";
interface TableRow {
  key: string;
  kind: RowKind;
  id: string;
  pet_id: string;
  pet_name: string;
  owner_name?: string | null;
  date: string | null;
  risk_level: number | null;
  risk_label: string;
  serious: boolean;
  symptoms: string[];
  symptomsDisplay: string;
  status: string;
  caseLink?: string;
  reportLink?: string;
}

function riskLabel(level: number | null): string {
  if (level == null) return "—";
  return `Level ${level}`;
}

function riskColor(level?: number | null) {
  if (level == null) return "default";
  if (level === 1 || level === 2) return "red";
  if (level === 3) return "orange";
  if (level === 4) return "gold";
  return "green";
}

export const VetCases: React.FC = () => {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [reports, setReports] = useState<SymptomReportRecord[]>([]);
  const [pets, setPets] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSerious, setFilterSerious] = useState<boolean | "all">("all");
  const [searchPetId, setSearchPetId] = useState("");
  const [searchSymptoms, setSearchSymptoms] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [casesRes, reportsRes, petsRes] = await Promise.all([
        api.get<CaseRecord[]>("/cases?limit=100"),
        api.get<SymptomReportRecord[]>("/symptom-reports?limit=100"),
        api.get<{ id: string; name: string }[]>("/pets"),
      ]);
      setCases(casesRes.data || []);
      setReports(reportsRes.data || []);
      setPets(petsRes.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const petIdToName = useMemo(() => {
    const m: Record<string, string> = {};
    pets.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [pets]);

  const needAttentionReports = useMemo(
    () =>
      reports.filter((r) => {
        if (r.system_serious) return true;
        const lvl = r.system_risk_level;
        return lvl === 1 || lvl === 2 || lvl === 3;
      }),
    [reports]
  );

  const caseRows: TableRow[] = useMemo(() => {
    return cases.map((c) => ({
      key: `case-${c.id}`,
      kind: "case" as RowKind,
      id: c.id,
      pet_id: c.pet_id,
      pet_name: petIdToName[c.pet_id] || `#${c.pet_id.slice(-8)}`,
      date: c.created_at || null,
      risk_level: c.risk_level ?? null,
      risk_label: c.risk_label || riskLabel(c.risk_level ?? null),
      serious: c.serious === true,
      symptoms: c.symptoms || [],
      symptomsDisplay: (c.symptoms && c.symptoms.length) ? c.symptoms.slice(0, 3).join(", ") + (c.symptoms.length > 3 ? " …" : "") : "—",
      status: c.status || "open",
      caseLink: `/vet/cases/${c.id}`,
    }));
  }, [cases, petIdToName]);

  const reportRows: TableRow[] = useMemo(
    () =>
      needAttentionReports.map((r) => {
        const sym = (r.symptoms && r.symptoms.length) ? r.symptoms.join(", ") : r.free_text || "—";
        return {
          key: `report-${r.id}`,
          kind: "report" as RowKind,
          id: r.id,
          pet_id: r.pet_id,
          pet_name: r.pet_name || petIdToName[r.pet_id] || `#${r.pet_id.slice(-8)}`,
          owner_name: r.owner_name,
          date: r.created_at,
          risk_level: r.system_risk_level,
          risk_label: riskLabel(r.system_risk_level),
          serious: r.system_serious,
          symptoms: r.symptoms || [],
          symptomsDisplay: sym.length > 80 ? sym.slice(0, 80) + "…" : sym,
          status: "Owner report",
          reportLink: "/vet/reports",
        };
      }),
    [needAttentionReports, petIdToName]
  );

  const allRows = useMemo(() => {
    const combined = [...caseRows, ...reportRows];
    combined.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return tb - ta;
    });
    return combined;
  }, [caseRows, reportRows]);

  const filteredRows = allRows.filter((r) => {
    if (filterSerious !== "all" && r.serious !== filterSerious) return false;
    if (searchPetId.trim()) {
      const q = searchPetId.trim().toLowerCase();
      if (!r.pet_id.toLowerCase().includes(q) && !r.pet_name.toLowerCase().includes(q)) return false;
    }
    if (searchSymptoms.trim()) {
      const terms = searchSymptoms.trim().toLowerCase().split(/\s+/);
      const symStr = r.symptomsDisplay.toLowerCase();
      if (!terms.every((t) => symStr.includes(t))) return false;
    }
    return true;
  });

  const columns = [
    {
      title: "Case / Report",
      key: "link",
      width: 130,
      render: (_: unknown, r: TableRow) =>
        r.caseLink ? (
          <Link to={r.caseLink}><Text strong>#{r.id.slice(-8)}</Text></Link>
        ) : (
          <Link to={r.reportLink!}><Text type="secondary">Report</Text></Link>
        ),
    },
    {
      title: "Pet",
      dataIndex: "pet_name",
      key: "pet_name",
      width: 120,
      render: (name: string) => <Text strong={!!name}>{name}</Text>,
    },
    {
      title: "Owner",
      key: "owner_name",
      width: 140,
      render: (_: unknown, r: TableRow) => (r.owner_name ? <Text>{r.owner_name}</Text> : "—"),
    },
    {
      title: "Date",
      key: "date",
      width: 110,
      render: (_: unknown, r: TableRow) =>
        r.date ? new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
    },
    {
      title: "Risk",
      key: "risk",
      width: 90,
      render: (_: unknown, r: TableRow) => (
        <Tag color={riskColor(r.risk_level)}>{r.risk_label}</Tag>
      ),
    },
    {
      title: "Serious",
      key: "serious",
      width: 80,
      render: (_: unknown, r: TableRow) => (
        <Tag color={r.serious ? "red" : "default"}>{r.serious ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "Symptoms",
      key: "symptomsDisplay",
      ellipsis: true,
      render: (_: unknown, r: TableRow) => <span title={r.symptomsDisplay}>{r.symptomsDisplay}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: string, r: TableRow) => (r.kind === "report" ? <Tag color="orange">{s}</Tag> : <Tag>{s}</Tag>),
    },
  ];

  return (
    <>
      <Title level={3} style={{ marginBottom: 4 }}>
        Cases
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        View and manage cases. Open a case to add vet notes and re-run risk analysis.
      </Text>

      <Card
        style={{ marginBottom: 16, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 16 }}
      >
        <Space wrap size="middle">
          <Select
            value={filterSerious}
            onChange={setFilterSerious}
            style={{ width: 160 }}
            options={[
              { value: "all", label: "All cases" },
              { value: true, label: "Serious only" },
              { value: false, label: "Not serious only" },
            ]}
          />
          <Input
            placeholder="Filter by Pet name or ID"
            prefix={<SearchOutlined />}
            value={searchPetId}
            onChange={(e) => setSearchPetId(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Input
            placeholder="Filter by symptoms"
            value={searchSymptoms}
            onChange={(e) => setSearchSymptoms(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
          <Button onClick={load}>Refresh</Button>
        </Space>
      </Card>

      <Card
        style={{ borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 16 }}
      >
        <Table
          rowKey="key"
          loading={loading}
          dataSource={filteredRows}
          columns={columns}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} items` }}
        />
      </Card>
    </>
  );
};
