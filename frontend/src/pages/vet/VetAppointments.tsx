import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Button,
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

interface Appointment {
  id: string;
  owner_id: string;
  pet_id: string;
  pet_name?: string | null;
  scheduled_at: string;
  reason: string;
  status: string;
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

const statusColors: Record<string, string> = {
  pending: "orange",
  confirmed: "green",
  cancelled: "default",
  completed: "blue",
};

function groupByDate(appointments: Appointment[]): { date: string; items: Appointment[] }[] {
  const map = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = dayjs(a.scheduled_at).format("YYYY-MM-DD");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }
  const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([date, items]) => ({ date, items }));
}

export const VetAppointments: React.FC = () => {
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Appointment[]>("/appointments");
      setList(res.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    await api.patch(`/appointments/${id}`, { status });
    load();
  }

  const now = dayjs();
  const todayStart = now.startOf("day").toDate();
  const todayEnd = now.endOf("day").toDate();
  const weekEnd = now.add(7, "day").endOf("day").toDate();

  const activeOnly = list.filter((a) => ["pending", "confirmed"].includes(a.status));
  const todayList = activeOnly.filter((a) => {
    const d = new Date(a.scheduled_at);
    return d >= todayStart && d <= todayEnd;
  });
  const weekList = activeOnly.filter((a) => new Date(a.scheduled_at) <= weekEnd);
  const pendingCount = list.filter((a) => a.status === "pending").length;

  const todayGrouped = groupByDate(todayList);
  const weekGrouped = groupByDate(weekList);
  const allGrouped = groupByDate(list);

  function renderSchedule(groups: { date: string; items: Appointment[] }[]) {
    if (groups.length === 0)
      return (
        <Text type="secondary" style={{ padding: 24, display: "block", textAlign: "center" }}>
          No appointments in this period.
        </Text>
      );
    return (
      <div style={{ maxHeight: 480, overflow: "auto" }}>
        {groups.map(({ date, items }) => (
          <Card
            size="small"
            key={date}
            style={{ marginBottom: 16, borderRadius: 12 }}
            title={
              <span>
                <CalendarOutlined style={{ marginRight: 8, color: "#1e40af" }} />
                {dayjs(date).format("DD.MM.YYYY")}
              </span>
            }
          >
            {items.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <ClockCircleOutlined style={{ color: "#64748b" }} />
                  <Text strong style={{ minWidth: 80 }}>
                    {dayjs(a.scheduled_at).format("HH:mm")}
                  </Text>
                  <Text strong>{a.pet_name || `#${a.pet_id.slice(-6)}`}</Text>
                  <Text type="secondary" ellipsis>
                    {a.reason || "—"}
                  </Text>
                </div>
                <Tag color={statusColors[a.status]}>{statusLabels[a.status]}</Tag>
                <span>
                  {a.status === "pending" && (
                    <>
                      <Button type="link" size="small" onClick={() => updateStatus(a.id, "confirmed")}>
                        Confirm
                      </Button>
                      <Button type="link" danger size="small" onClick={() => updateStatus(a.id, "cancelled")}>
                        Cancel
                      </Button>
                    </>
                  )}
                  {a.status === "confirmed" && (
                    <Button type="link" size="small" onClick={() => updateStatus(a.id, "completed")}>
                      Completed
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    );
  }

  const columns = [
    {
      title: "Date / Time",
      key: "scheduled_at",
      render: (_: unknown, r: Appointment) =>
        dayjs(r.scheduled_at).format("DD.MM.YYYY HH:mm"),
    },
    {
      title: "Pet",
      key: "pet_name",
      render: (_: unknown, r: Appointment) => (
        <Text strong>{r.pet_name || `#${r.pet_id.slice(-6)}`}</Text>
      ),
    },
    { title: "Reason", dataIndex: "reason", key: "reason", ellipsis: true },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={statusColors[s] || "default"}>{statusLabels[s] || s}</Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_: unknown, r: Appointment) => (
        <span>
          {r.status === "pending" && (
            <>
              <Button type="link" size="small" onClick={() => updateStatus(r.id, "confirmed")}>
                Confirm
              </Button>
              <Button type="link" danger size="small" onClick={() => updateStatus(r.id, "cancelled")}>
                Cancel
              </Button>
            </>
          )}
          {r.status === "confirmed" && (
            <Button type="link" size="small" onClick={() => updateStatus(r.id, "completed")}>
              Completed
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4, color: "#0f172a" }}>
          Appointments
        </Title>
        <Text type="secondary" style={{ display: "block" }}>
          View all appointments; filter by today, this week, or full schedule.
        </Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }} loading={loading}>
            <Statistic
              title="Total"
              value={list.length}
              prefix={<CalendarOutlined style={{ color: "#0f172a" }} />}
              valueStyle={{ color: "#0f172a", fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>appointment(s)</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }} loading={loading}>
            <Statistic
              title="Today"
              value={todayList.length}
              prefix={<ClockCircleOutlined style={{ color: "#1e40af" }} />}
              valueStyle={{ color: "#1e40af", fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>active today</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }} loading={loading}>
            <Statistic
              title="Pending"
              value={pendingCount}
              prefix={<SyncOutlined spin={pendingCount > 0} style={{ color: "#d97706" }} />}
              valueStyle={{ color: "#d97706", fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>to confirm</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }} loading={loading}>
            <Statistic
              title="This week"
              value={weekList.length}
              prefix={<CheckCircleOutlined style={{ color: "#059669" }} />}
              valueStyle={{ color: "#059669", fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>active (pending + confirmed)</Text>
          </Card>
        </Col>
      </Row>

      <Card
        style={{ borderRadius: 16, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          defaultActiveKey="today"
          size="large"
          items={[
            {
              key: "today",
              label: "Today",
              children: renderSchedule(todayGrouped),
            },
            {
              key: "week",
              label: "This week",
              children: renderSchedule(weekGrouped),
            },
            {
              key: "all",
              label: `All (${list.length})`,
              children: renderSchedule(allGrouped),
            },
            {
              key: "table",
              label: "Table view",
              children: (
                <div style={{ padding: 16 }}>
                  <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={list}
                    columns={columns}
                    size="middle"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `Total: ${total} appointment(s)`,
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};
