import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card, Col, Row, Typography, Avatar, Alert } from "antd";
import {
  FileTextOutlined,
  CalendarOutlined,
  TeamOutlined,
  MedicineBoxOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

interface CaseSummary {
  id: string;
  pet_id: string;
  symptoms: string[];
  serious?: boolean | null;
  created_at?: string | null;
}

const { Title, Text } = Typography;

interface VaccineEntry {
  vaccine_type: string;
  status?: "done" | "planned";
  vaccinated_at?: string | null;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  vaccine_history?: VaccineEntry[];
}

function getNextVaccine(pet: Pet): { date: string; daysLeft: number } | null {
  const planned = (pet.vaccine_history || []).filter(
    (e) => e.status === "planned" && e.vaccinated_at
  );
  if (planned.length === 0) return null;
  const sorted = planned
    .map((e) => e.vaccinated_at as string)
    .filter(Boolean)
    .sort();
  const next = sorted[0];
  if (!next) return null;
  const d = dayjs(next);
  return { date: d.format("DD.MM.YYYY"), daysLeft: d.diff(dayjs(), "day") };
}

interface AppointmentItem {
  id: string;
  pet_name?: string | null;
  scheduled_at: string;
  status: string;
}

export const OwnerDashboard: React.FC = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCases, setLoadingCases] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Pet[]>("/pets").then((res) => setPets(res.data || [])),
      api.get<AppointmentItem[]>("/appointments").then((res) => setAppointments(res.data || [])),
    ]).finally(() => setLoading(false));
    api.get<CaseSummary[]>("/cases?limit=50").then((res) => {
      setCases(res.data || []);
      setLoadingCases(false);
    }).catch(() => setLoadingCases(false));
  }, []);

  const petIdToName = useMemo(() => {
    const m: Record<string, string> = {};
    pets.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [pets]);

  const criticalCases = useMemo(
    () => cases.filter((c) => c.serious === true),
    [cases]
  );

  const upcomingAppointments = appointments
    .filter((a) => ["pending", "confirmed"].includes(a.status) && new Date(a.scheduled_at) >= new Date())
    .slice(0, 3);

  return (
    <div
      className="page-head"
      style={{
        minHeight: "100%",
        background: "linear-gradient(160deg, #e0f2fe 0%, #f0fdf4 50%, #fefce8 100%)",
        borderRadius: 20,
        padding: "clamp(20px, 4vw, 28px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative background */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.4)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: -60,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "rgba(187,247,208,0.5)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <Title level={3} style={{ marginBottom: 4, color: "#0f766e" }}>
          Paws & Care
        </Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
          Welcome to your pet care dashboard.
        </Text>

        {!loadingCases && criticalCases.length > 0 && (
          <Link to="/owner/history" style={{ textDecoration: "none", display: "block", marginBottom: 16 }}>
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <WarningOutlined />
                  Critical alerts — {criticalCases.length} case(s) need attention
                </span>
              }
              description={
                <div style={{ marginTop: 8 }}>
                  {criticalCases.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "4px 0",
                      }}
                    >
                      <WarningOutlined style={{ color: "#b91c1c", marginTop: 2, flexShrink: 0 }} />
                      <span>
                        <strong style={{ color: "#b91c1c" }}>
                          {petIdToName[c.pet_id] || `Pet`}
                        </strong>
                        {" — "}
                        {(c.symptoms && c.symptoms.length) ? c.symptoms.join(", ") : "See details"}
                      </span>
                    </div>
                  ))}
                  {criticalCases.length > 5 && (
                    <span style={{ fontSize: 12, color: "inherit" }}>+{criticalCases.length - 5} more. Click to open Health Records.</span>
                  )}
                </div>
              }
              style={{
                borderRadius: 12,
                border: "1px solid #fcd34d",
                background: "#fffbeb",
              }}
            />
          </Link>
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card
              title={
                <span>
                  <TeamOutlined style={{ marginRight: 8, color: "#0d9488" }} />
                  My Pets
                </span>
              }
              loading={loading}
              style={{
                borderRadius: 16,
                border: "none",
                boxShadow: "0 4px 12px rgba(13,148,136,0.12)",
                background: "#fff",
              }}
              bodyStyle={{ padding: 16 }}
            >
              {!loading && pets.length === 0 ? (
                <Text type="secondary">
                  No pets registered yet.{" "}
                  <Link to="/owner/pets">Add a pet</Link>.
                </Text>
              ) : (
                <Row gutter={[12, 12]}>
                  {pets.slice(0, 4).map((pet) => {
                    const next = getNextVaccine(pet);
                    return (
                      <Col xs={24} sm={12} key={pet.id}>
                        <Card
                          size="small"
                          style={{
                            borderRadius: 12,
                            background: "#f0fdfa",
                            border: "1px solid #99f6e4",
                          }}
                          bodyStyle={{ padding: 12 }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Avatar
                              size={48}
                              style={{ background: "#14b8a6", flexShrink: 0 }}
                            >
                              {pet.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text strong style={{ display: "block" }}>
                                {pet.name} ({pet.species})
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                                {(pet.vaccine_history || []).length > 0
                                  ? `${(pet.vaccine_history || []).length} vaccine record(s)`
                                  : "No vaccine records"}
                              </Text>
                              {next && (
                                <>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    Next vaccine: {next.date}
                                    {next.daysLeft > 0
                                      ? ` (in ${next.daysLeft} days)`
                                      : next.daysLeft === 0
                                        ? " (Today)"
                                        : " (Overdue)"}
                                  </Text>
                                </>
                              )}
                            </div>
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Link to="/owner/appointments" style={{ textDecoration: "none" }}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(59,130,246,0.2)",
                  background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                  marginBottom: 16,
                  cursor: "pointer",
                }}
                bodyStyle={{ padding: 16 }}
              >
                <CalendarOutlined style={{ fontSize: 28, color: "#1d4ed8", marginBottom: 8 }} />
                <Title level={5} style={{ margin: 0, color: "#1e40af" }}>
                  Upcoming Appointments
                </Title>
                {upcomingAppointments.length > 0 ? (
                  <>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {upcomingAppointments[0].pet_name} – {dayjs(upcomingAppointments[0].scheduled_at).format("DD.MM.YYYY HH:mm")}
                    </Text>
                    {upcomingAppointments.length > 1 && (
                      <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                        +{upcomingAppointments.length - 1} more appointment(s)
                      </Text>
                    )}
                  </>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Click to book an appointment
                  </Text>
                )}
              </Card>
            </Link>

            <Link to="/owner/check" style={{ textDecoration: "none" }}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(251,191,36,0.2)",
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                  marginBottom: 16,
                  cursor: "pointer",
                }}
                bodyStyle={{ padding: 16 }}
              >
                <CalendarOutlined style={{ fontSize: 28, color: "#d97706", marginBottom: 8 }} />
                <Title level={5} style={{ margin: 0, color: "#92400e" }}>
                  Report Symptom / Check
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Report your pet's symptoms and receive vet feedback.
                </Text>
              </Card>
            </Link>

            <Link to="/owner/history" style={{ textDecoration: "none" }}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  boxShadow: "0 4px 12px rgba(52,211,153,0.2)",
                  background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
                  marginBottom: 16,
                  cursor: "pointer",
                }}
                bodyStyle={{ padding: 16 }}
              >
                <FileTextOutlined style={{ fontSize: 28, color: "#059669", marginBottom: 8 }} />
                <Title level={5} style={{ margin: 0, color: "#047857" }}>
                  Health Records
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Your symptom reports and vet feedback.
                </Text>
              </Card>
            </Link>
          </Col>

          <Col xs={24}>
            <Link to="/owner/pets" style={{ textDecoration: "none" }}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  background: "#fff",
                  cursor: "pointer",
                }}
                bodyStyle={{ padding: 16 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <MedicineBoxOutlined style={{ fontSize: 24, color: "#0d9488" }} />
                    <div>
                      <Text strong>Pet Records</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Add details and vaccine history
                      </Text>
                    </div>
                  </div>
                  <span style={{ color: "#0d9488", fontWeight: 600 }}>Go →</span>
                </div>
              </Card>
            </Link>
          </Col>
        </Row>
      </div>
    </div>
  );
};
