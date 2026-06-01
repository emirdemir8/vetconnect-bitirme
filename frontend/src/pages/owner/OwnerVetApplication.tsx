import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Spin, Typography, message } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";

const { Paragraph, Text } = Typography;

type AppStatus = "pending" | "approved" | "rejected";

interface VetApplication {
  id: string;
  status: AppStatus;
  clinic_name: string;
  license_reference: string;
  notes: string | null;
  created_at: string;
  reject_reason: string | null;
}

export const OwnerVetApplication: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [latest, setLatest] = useState<VetApplication | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<VetApplication | null>("/vet-applications/me");
      setLatest(res.data ?? null);
      if (res.data?.status === "approved") await refreshUser();
    } catch (err: unknown) {
      setLatest(null);
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 401) {
        message.error("Your session may have expired; please sign in again.");
      } else if (status && status >= 400) {
        message.error(typeof detail === "string" ? detail : "Could not load application details.");
      } else {
        message.error("Could not connect to the server. Is the backend running on port 8000?");
      }
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (user?.role === "vet") navigate("/vet/dashboard", { replace: true });
  }, [user, navigate]);

  async function onFinish(values: { clinic_name: string; license_reference: string; notes?: string }) {
    setSubmitting(true);
    try {
      await api.post("/vet-applications", {
        clinic_name: values.clinic_name.trim(),
        license_reference: values.license_reference.trim(),
        notes: values.notes?.trim() || undefined,
      });
      form.resetFields();
      message.success("Your application was submitted.");
      await load();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 409) message.warning(typeof detail === "string" ? detail : "You already have a pending application.");
      else if (status === 403) message.error(typeof detail === "string" ? detail : "You are not eligible for this action.");
      else message.error(typeof detail === "string" ? detail : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const pending = latest?.status === "pending";
  const approved = latest?.status === "approved";
  const rejected = latest?.status === "rejected";

  return (
    <div style={{ maxWidth: 640 }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        <SafetyCertificateOutlined style={{ marginRight: 10 }} />
        Veterinarian panel application
      </Typography.Title>
      <Paragraph type="secondary">
        When an administrator approves your application, your account is moved to the veterinarian panel. If
        rejected, the reason is shown and you can submit a new application.
      </Paragraph>

      {pending && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
          message="Your application is pending"
          description={
            <>
              <Text>Clinic: {latest?.clinic_name}</Text>
              <br />
              <Text>Reference: {latest?.license_reference}</Text>
            </>
          }
        />
      )}

      {approved && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 24 }}
          message="Your application was approved"
          description="Sign out and sign in again from the top menu, or refresh the page, to access the veterinarian panel."
        />
      )}

      {rejected && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          message="Your last application was rejected"
          description={latest?.reject_reason || "No reason provided."}
        />
      )}

      {!pending && (
        <Card title="New application">
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="clinic_name"
              label="Clinic / practice name"
              rules={[{ required: true, min: 2, message: "Enter at least 2 characters." }]}
            >
              <Input placeholder="e.g. Sample Veterinary Clinic" maxLength={200} />
            </Form.Item>
            <Form.Item
              name="license_reference"
              label="License / diploma / registry reference"
              rules={[{ required: true, min: 2, message: "Enter at least 2 characters." }]}
            >
              <Input placeholder="Official registration number or reference" maxLength={120} />
            </Form.Item>
            <Form.Item name="notes" label="Additional note (optional)">
              <Input.TextArea rows={4} maxLength={2000} showCount placeholder="Optional notes" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Submit application
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
};
