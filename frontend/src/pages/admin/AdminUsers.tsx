import React, { useCallback, useEffect, useState } from "react";
import { Button, Input, Modal, Space, Table, Tag, Typography, Alert, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { api } from "../../lib/apiClient";

const { Paragraph } = Typography;

interface UserRow {
  id: string;
  email: string;
  role: "vet" | "pet_owner" | "admin";
  full_name: string | null;
}

const roleColors: Record<UserRow["role"], string> = {
  admin: "purple",
  vet: "blue",
  pet_owner: "cyan",
};

export const AdminUsers: React.FC = () => {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; temp_password: string } | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await api.get<UserRow[]>("/admin/users", { params: { query: q } });
      setRows(res.data || []);
    } catch {
      message.error("Could not load users.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function doReset(row: UserRow) {
    setBusyId(row.id);
    try {
      const res = await api.post<{ email: string; temp_password: string }>(
        `/admin/users/${row.id}/reset-password`,
      );
      setResetResult({ email: res.data.email, temp_password: res.data.temp_password });
    } catch {
      message.error("Could not reset password.");
    } finally {
      setBusyId(null);
    }
  }

  function confirmReset(row: UserRow) {
    Modal.confirm({
      title: "Reset password",
      content: `A temporary password will be generated for ${row.email}. The user must change it after signing in. Continue?`,
      okText: "Reset",
      okButtonProps: { danger: true },
      onOk: () => doReset(row),
    });
  }

  const columns: ColumnsType<UserRow> = [
    { title: "Email", dataIndex: "email", key: "email", ellipsis: true },
    { title: "Name", dataIndex: "full_name", key: "full_name", width: 180, render: (v) => v || "—" },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (r: UserRow["role"]) => <Tag color={roleColors[r]}>{r}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_, r) => (
        <Button size="small" danger loading={busyId === r.id} onClick={() => confirmReset(r)}>
          Reset password
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Users
      </Typography.Title>
      <Paragraph type="secondary">
        Search users and reset a forgotten password. A temporary password is generated and shown once; share it
        securely with the user, who should change it after signing in.
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="Search by email or name"
          style={{ width: 320 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={(v) => void load(v.trim())}
          enterButton
        />
        <Button onClick={() => void load(query.trim())} loading={loading}>
          Refresh
        </Button>
      </Space>

      <Table<UserRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 700 }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Temporary password generated"
        open={!!resetResult}
        onCancel={() => setResetResult(null)}
        onOk={() => setResetResult(null)}
        okText="Done"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="This password is shown only once. Copy it now and share it securely."
        />
        <div style={{ marginBottom: 8 }}>
          User: <strong>{resetResult?.email}</strong>
        </div>
        <div>Temporary password:</div>
        <Paragraph copyable={{ text: resetResult?.temp_password }} style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
          {resetResult?.temp_password}
        </Paragraph>
      </Modal>
    </div>
  );
};
