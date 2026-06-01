import React, { useCallback, useEffect, useState } from "react";
import { Button, Modal, Select, Space, Table, Tag, Typography, Input, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { api } from "../../lib/apiClient";

const { Paragraph } = Typography;

type RowStatus = "pending" | "approved" | "rejected";

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  clinic_name: string;
  license_reference: string;
  notes: string | null;
  status: RowStatus;
  created_at: string;
  reject_reason: string | null;
}

interface ClinicOpt {
  id: string;
  name: string;
  network_key?: string | null;
}

export const AdminVetApplications: React.FC = () => {
  const [listStatus, setListStatus] = useState<RowStatus | "all">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [approveId, setApproveId] = useState<string | null>(null);
  const [clinics, setClinics] = useState<ClinicOpt[]>([]);
  const [approveClinicId, setApproveClinicId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Row[]>("/admin/vet-applications", {
        params: { status: listStatus },
      });
      setRows(res.data || []);
    } catch {
      message.error("Could not load list.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!approveId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ClinicOpt[]>("/clinics");
        if (!cancelled) setClinics((res.data || []).map((c) => ({ id: c.id, name: c.name })));
      } catch {
        if (!cancelled) message.error("Could not load clinic list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approveId]);

  function openApprove(id: string) {
    setApproveId(id);
    setApproveClinicId(undefined);
  }

  async function confirmApprove() {
    if (!approveId || !approveClinicId) {
      message.warning("Select a clinic first.");
      return;
    }
    setBusyId(approveId);
    try {
      await api.post(`/admin/vet-applications/${approveId}/approve`, { clinic_id: approveClinicId });
      message.success("Approved; veterinarian assigned to the selected clinic.");
      setApproveId(null);
      setApproveClinicId(undefined);
      await load();
    } catch {
      message.error("Approval failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejectId) return;
    setBusyId(rejectId);
    try {
      await api.post(`/admin/vet-applications/${rejectId}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      message.success("Application rejected.");
      setRejectId(null);
      setRejectReason("");
      await load();
    } catch {
      message.error("Rejection failed.");
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnsType<Row> = [
    { title: "Email", dataIndex: "email", key: "email", width: 200, ellipsis: true },
    { title: "Name", dataIndex: "full_name", key: "full_name", width: 140, render: (v) => v || "—" },
    { title: "Applied clinic name", dataIndex: "clinic_name", key: "clinic_name", ellipsis: true },
    { title: "Reference", dataIndex: "license_reference", key: "license_reference", width: 140, ellipsis: true },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: RowStatus) => {
        const colors: Record<RowStatus, string> = {
          pending: "gold",
          approved: "green",
          rejected: "red",
        };
        return <Tag color={colors[s]}>{s}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_, r) =>
        r.status === "pending" ? (
          <Space>
            <Button type="primary" size="small" loading={busyId === r.id} onClick={() => openApprove(r.id)}>
              Approve
            </Button>
            <Button size="small" danger loading={busyId === r.id} onClick={() => setRejectId(r.id)}>
              Reject
            </Button>
          </Space>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Veterinarian applications
      </Typography.Title>
      <Paragraph type="secondary">
        On approval, assign the veterinarian to a <strong>clinic</strong>; only data from owners who are members of
        that clinic appears in their veterinarian panel.
      </Paragraph>
      <Space style={{ marginBottom: 16 }}>
        <span>Status:</span>
        <Select
          value={listStatus}
          onChange={(v) => setListStatus(v)}
          style={{ width: 160 }}
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All" },
          ]}
        />
        <Button onClick={() => void load()} loading={loading}>
          Refresh
        </Button>
      </Space>
      <Table<Row>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 900 }}
        expandable={{
          expandedRowRender: (r) => (
            <div style={{ maxWidth: 560 }}>
              <div>
                <strong>Notes:</strong> {r.notes || "—"}
              </div>
              {r.reject_reason && (
                <div style={{ marginTop: 8 }}>
                  <strong>Rejection reason:</strong> {r.reject_reason}
                </div>
              )}
            </div>
          ),
          rowExpandable: (r) => !!(r.notes || r.reject_reason),
        }}
      />
      <Modal
        title="Approve veterinarian"
        open={!!approveId}
        onCancel={() => {
          setApproveId(null);
          setApproveClinicId(undefined);
        }}
        onOk={() => void confirmApprove()}
        okText="Approve"
        okButtonProps={{ loading: !!busyId && busyId === approveId }}
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          This user is assigned the <strong>vet</strong> role and linked to the clinic you select.
        </Paragraph>
        <div style={{ marginBottom: 8 }}>Clinic</div>
        <Select
          style={{ width: "100%" }}
          placeholder="Select clinic"
          value={approveClinicId}
          onChange={(v) => setApproveClinicId(v)}
          options={clinics.map((c) => ({
            value: c.id,
            label: c.network_key ? `${c.name} (${c.network_key})` : c.name,
          }))}
        />
      </Modal>
      <Modal
        title="Reject application"
        open={!!rejectId}
        onCancel={() => {
          setRejectId(null);
          setRejectReason("");
        }}
        onOk={confirmReject}
        okText="Reject"
        okButtonProps={{ danger: true, loading: !!busyId && busyId === rejectId }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Optional reason (shown to the user)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
};
