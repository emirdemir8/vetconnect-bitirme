import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

interface Appointment {
  id: string;
  pet_id: string;
  pet_name?: string | null;
  scheduled_at: string;
  reason: string;
  status: string;
}

interface Pet {
  id: string;
  name: string;
  species: string;
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

export const OwnerAppointments: React.FC = () => {
  const [list, setList] = useState<Appointment[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  async function load() {
    setLoading(true);
    try {
      const [appRes, petsRes] = await Promise.all([
        api.get<Appointment[]>("/appointments"),
        api.get<Pet[]>("/pets"),
      ]);
      setList(appRes.data || []);
      setPets(petsRes.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit() {
    const values = await form.validateFields();
    const scheduled = values.scheduled_at
      ? dayjs(values.scheduled_at).toISOString()
      : null;
    if (!scheduled || !values.pet_id) return;
    await api.post("/appointments", {
      pet_id: values.pet_id,
      scheduled_at: scheduled,
      reason: values.reason || "",
    });
    form.resetFields();
    setModalOpen(false);
    load();
  }

  async function cancelAppointment(id: string) {
    await api.patch(`/appointments/${id}`, { status: "cancelled" });
    load();
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
        <Text strong>{r.pet_name || `Pet #${r.pet_id.slice(-6)}`}</Text>
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
      render: (_: unknown, r: Appointment) =>
        r.status === "pending" ? (
          <Button type="link" danger size="small" onClick={() => cancelAppointment(r.id)}>
            Cancel
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Title level={3} style={{ marginBottom: 4 }}>
        Appointments
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Create a new appointment or view your existing appointments.
      </Text>

      <Card
        style={{ borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 16 }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setModalOpen(true);
            }}
          >
            New Appointment
          </Button>
        }
      >
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
      </Card>

      <Modal
        title="New Appointment"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Create appointment"
        cancelText="Cancel"
      >
        <Form layout="vertical" form={form} style={{ marginTop: 16 }}>
          <Form.Item
            name="pet_id"
            label="Pet"
            rules={[{ required: true, message: "Select a pet" }]}
          >
            <Select
              placeholder="Select pet"
              options={pets.map((p) => ({ value: p.id, label: `${p.name} (${p.species})` }))}
            />
          </Form.Item>
          <Form.Item
            name="scheduled_at"
            label="Date and time"
            rules={[{ required: true, message: "Select date and time" }]}
          >
            <DatePicker
              showTime
              format="DD.MM.YYYY HH:mm"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason for appointment">
            <Input.TextArea
              rows={2}
              placeholder="e.g. Check-up, vaccination, parasite treatment..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
