import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Typography,
  Tag,
  Button,
  Alert,
} from "antd";
import {
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

interface SymptomReportAlert {
  id: string;
  pet_id?: string;
  pet_name?: string | null;
  owner_name?: string | null;
  animal_species?: string | null;
  product_or_vaccine?: string | null;
  symptoms: string[];
  free_text?: string | null;
  system_serious: boolean;
  system_risk_level: number | null;
  system_risk_label: string | null;
  created_at: string | null;
}

interface StatsOverview {
  total_cases: number;
  serious_cases: number;
  non_serious_cases: number;
  by_risk_level: { risk_level: number; count: number }[];
}

interface PetRecord {
  id: string;
  name: string;
  species: string;
  owner_id?: string | null;
}

interface AppointmentItem {
  id: string;
  pet_name?: string | null;
  scheduled_at: string;
  reason: string;
  status: string;
}

interface CaseSummary {
  id: string;
  pet_id: string;
  symptoms: string[];
  risk_level?: number | null;
  risk_label?: string | null;
  serious?: boolean | null;
  status: string;
  created_at?: string | null;
}

type RecentRowKind = "case" | "report";
interface RecentRow {
  key: string;
  kind: RecentRowKind;
  id: string;
  pet_name: string;
  date: string | null;
  risk_level: number | null;
  risk_label: string;
  serious: boolean;
  symptomsDisplay: string;
  caseLink?: string;
  reportLink?: string;
}

export const VetDashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [recentCases, setRecentCases] = useState<CaseSummary[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingPets, setLoadingPets] = useState(true);
  const [loadingCases, setLoadingCases] = useState(true);
  const [symptomReports, setSymptomReports] = useState<SymptomReportAlert[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    api.get<StatsOverview>("/stats/overview").then((res) => {
      setStats(res?.data ?? null);
      setLoadingStats(false);
    }).catch(() => { setLoadingStats(false); });
    api.get<AppointmentItem[]>("/appointments").then((res) => {
      setAppointments(res?.data ?? []);
      setLoadingAppointments(false);
    }).catch(() => setLoadingAppointments(false));
    api.get<PetRecord[]>("/pets").then((res) => {
      setPets(res?.data ?? []);
      setLoadingPets(false);
    }).catch(() => setLoadingPets(false));
    api.get<CaseSummary[]>("/cases?limit=30").then((res) => {
      setRecentCases(res?.data ?? []);
      setLoadingCases(false);
    }).catch(() => setLoadingCases(false));
    api.get<SymptomReportAlert[]>("/symptom-reports?limit=100").then((res) => {
      setSymptomReports(res?.data ?? []);
      setLoadingReports(false);
    }).catch(() => setLoadingReports(false));
  }, []);

  const petIdToName = useMemo(() => {
    const m: Record<string, string> = {};
    pets.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [pets]);

  const sortedRecentCases = useMemo(() => {
    return [...recentCases].sort((a, b) => {
      const aCrit = a.serious === true ? 1 : 0;
      const bCrit = b.serious === true ? 1 : 0;
      if (bCrit !== aCrit) return bCrit - aCrit;
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });
  }, [recentCases]);

  const criticalCases = useMemo(() => sortedRecentCases.filter((c) => c.serious === true), [sortedRecentCases]);

  const ownerAlerts = useMemo(() => {
    return symptomReports.filter((r) => {
      if (r.system_serious === true) return true;
      const lvl = r.system_risk_level;
      return lvl === 1 || lvl === 2 || lvl === 3;
    });
  }, [symptomReports]);

  const recentTableRows = useMemo((): RecentRow[] => {
    const caseRows: RecentRow[] = (sortedRecentCases || []).map((c) => ({
      key: `case-${c.id}`,
      kind: "case" as RecentRowKind,
      id: c.id,
      pet_name: petIdToName[c.pet_id] || `#${c.pet_id.slice(-8)}`,
      date: c.created_at || null,
      risk_level: c.risk_level ?? null,
      risk_label: c.risk_label ?? (c.risk_level != null ? `Level ${c.risk_level}` : "—"),
      serious: c.serious === true,
      symptomsDisplay: (c.symptoms && c.symptoms.length) ? c.symptoms.slice(0, 2).join(", ") + (c.symptoms.length > 2 ? " …" : "") : "—",
      caseLink: `/vet/cases/${c.id}`,
    }));
    const reportRows: RecentRow[] = (ownerAlerts || []).map((r) => {
      const sym = (r.symptoms && r.symptoms.length) ? r.symptoms.join(", ") : r.free_text || "—";
      return {
        key: `report-${r.id}`,
        kind: "report" as RecentRowKind,
        id: r.id,
        pet_name: r.pet_name || (r.pet_id ? petIdToName[r.pet_id] || `#${r.pet_id.slice(-8)}` : "—"),
        date: r.created_at,
        risk_level: r.system_risk_level,
        risk_label: r.system_risk_level != null ? `Level ${r.system_risk_level}` : "—",
        serious: r.system_serious,
        symptomsDisplay: sym.length > 60 ? sym.slice(0, 60) + "…" : sym,
        reportLink: "/vet/reports",
      };
    });
    const combined = [...caseRows, ...reportRows];
    combined.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return tb - ta;
    });
    return combined;
  }, [sortedRecentCases, ownerAlerts, petIdToName]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayAppointments = appointments.filter((a) => {
    if (!["pending", "confirmed"].includes(a.status)) return false;
    const d = new Date(a.scheduled_at);
    return d >= todayStart && d <= todayEnd;
  }).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const todayCasesCount = recentCases.filter((c) => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d >= todayStart && d <= todayEnd;
  }).length;

  function riskColor(level?: number | null) {
    if (level == null) return "default";
    if (level === 1 || level === 2) return "red";
    if (level === 3) return "orange";
    if (level === 4) return "gold";
    return "green";
  }

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%", padding: 4 }}>
      <Title level={3} style={{ marginBottom: 4, color: "#0f172a" }}>
        Veterinary Clinic
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Today's summary and patient records.
      </Text>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <CalendarOutlined style={{ marginRight: 8, color: "#1e40af" }} />
                Today's Appointments
              </span>
            }
            loading={loadingAppointments}
            extra={
              <Link to="/vet/appointments">
                <Button type="link" size="small">View all</Button>
              </Link>
            }
            style={{
              borderRadius: 16,
              border: "none",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
            bodyStyle={{ padding: 16 }}
          >
            {!loadingAppointments && todayAppointments.length === 0 ? (
              <Text type="secondary">No appointments today. Go to Appointments for the full schedule.</Text>
            ) : (
              <div style={{ maxHeight: 280, overflow: "auto" }}>
                {todayAppointments.slice(0, 10).map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: i < todayAppointments.length - 1 ? "1px solid #f1f5f9" : "none",
                    }}
                  >
                    <div>
                      <Text strong>{a.pet_name || `#${a.id.slice(-6)}`}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(a.scheduled_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} • {a.reason || "—"}
                      </Text>
                    </div>
                    <Tag color={a.status === "confirmed" ? "green" : "orange"}>{a.status === "confirmed" ? "Confirmed" : "Pending"}</Tag>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <WarningOutlined style={{ marginRight: 8, color: "#b91c1c" }} />
                Critical Cases
              </span>
            }
            loading={loadingStats}
            style={{
              borderRadius: 16,
              border: "none",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              background: loadingStats ? undefined : "#fef2f2",
            }}
            bodyStyle={{ padding: 16 }}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total cases"
                  value={stats?.total_cases ?? 0}
                  valueStyle={{ color: "#1e40af", fontWeight: 700 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Critical (serious)"
                  value={stats?.serious_cases ?? 0}
                  valueStyle={{ color: "#b91c1c", fontWeight: 700 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Today's cases"
                  value={todayCasesCount}
                  valueStyle={{ color: "#0d9488", fontWeight: 700 }}
                />
              </Col>
            </Row>
            {stats?.by_risk_level && stats.by_risk_level.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Risk distribution:{" "}
                  {stats.by_risk_level.map((r) => (
                    <Tag key={r.risk_level} color="orange">
                      Level {r.risk_level}: {r.count}
                    </Tag>
                  ))}
                </Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title={
              <span>
                <TeamOutlined style={{ marginRight: 8, color: "#0d9488" }} />
                Patient Records
              </span>
            }
            loading={loadingPets}
            style={{
              borderRadius: 16,
              border: "none",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
            bodyStyle={{ padding: 16 }}
            extra={
              <Link to="/vet/pets">
                <Button type="primary" size="small">
                  View all / Edit
                </Button>
              </Link>
            }
          >
            <Table
              rowKey="id"
              dataSource={pets.slice(0, 10)}
              size="small"
              pagination={false}
              columns={[
                {
                  title: "ID",
                  dataIndex: "id",
                  key: "id",
                  width: 100,
                  render: (id: string) => (
                    <Text type="secondary" style={{ fontFamily: "monospace" }}>
                      #{String(id).slice(-8)}
                    </Text>
                  ),
                },
                {
                  title: "Name",
                  dataIndex: "name",
                  key: "name",
                  render: (t: string) => <Text strong>{t}</Text>,
                },
                {
                  title: "Species",
                  dataIndex: "species",
                  key: "species",
                  render: (s: string) => <Tag color="blue">{s}</Tag>,
                },
                {
                  title: "Action",
                  key: "action",
                  width: 100,
                  render: () => <Link to="/vet/pets">Records</Link>,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title={
              <span>
                <FileTextOutlined style={{ marginRight: 8, color: "#1e40af" }} />
                Recent cases (vet-opened)
              </span>
            }
            loading={loadingCases}
            style={{
              borderRadius: 16,
              border: "none",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
            bodyStyle={{ padding: 16 }}
            extra={
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link to="/vet/reports">
                  <Button type="link" size="small">Symptom reports</Button>
                </Link>
                <Link to="/vet/cases">
                  <Button type="link" size="small">View all cases</Button>
                </Link>
              </span>
            }
          >
            <Table
              rowKey="key"
              dataSource={recentTableRows}
              loading={loadingCases || loadingReports}
              size="small"
              pagination={false}
              rowClassName={(r) => (r.serious ? "vet-row-critical" : "")}
              columns={[
                {
                  title: "",
                  key: "icon",
                  width: 36,
                  render: (_: unknown, r: RecentRow) =>
                    r.serious ? (
                      <ExclamationCircleOutlined style={{ color: "#b91c1c", fontSize: 16 }} title="Critical" />
                    ) : null,
                },
                {
                  title: "Case / Report",
                  key: "link",
                  width: 110,
                  render: (_: unknown, r: RecentRow) =>
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
                  title: "Date",
                  key: "date",
                  width: 110,
                  render: (_: unknown, r: RecentRow) =>
                    r.date
                      ? new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                      : "—",
                },
                {
                  title: "Risk",
                  key: "risk",
                  width: 90,
                  render: (_: unknown, r: RecentRow) => (
                    <Tag color={riskColor(r.risk_level)}>{r.risk_label}</Tag>
                  ),
                },
                {
                  title: "Serious",
                  key: "serious",
                  width: 80,
                  render: (_: unknown, r: RecentRow) => (
                    <Tag color={r.serious ? "red" : "default"}>{r.serious ? "Yes" : "No"}</Tag>
                  ),
                },
                {
                  title: "Symptoms",
                  dataIndex: "symptomsDisplay",
                  key: "symptoms",
                  ellipsis: true,
                  render: (t: string, r: RecentRow) => <span title={r.symptomsDisplay}>{t}</span>,
                },
              ]}
            />
            <style>{`
              .vet-row-critical { background: #fef2f2 !important; }
              .vet-row-critical:hover > td { background: #fee2e2 !important; }
            `}</style>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
