import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Select, Space, Typography, message } from "antd";
import { BankOutlined } from "@ant-design/icons";
import { api } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";

interface MembershipOption {
  clinic_id: string;
  display_name: string;
  subtitle: string;
  network_key?: string | null;
  branch_count: number;
  branch_clinic_ids: string[];
}

export const OwnerClinic: React.FC = () => {
  const { user, updateClinic } = useAuth();
  const [options, setOptions] = useState<MembershipOption[]>([]);
  const [value, setValue] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const selectOptions = useMemo(
    () =>
      options.map((o) => ({
        value: o.clinic_id,
        label: o.display_name,
        title: o.subtitle || o.display_name,
      })),
    [options],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<MembershipOption[]>("/clinics/membership-options");
        if (!cancelled) setOptions(res.data || []);
      } catch {
        if (!cancelled) message.error("Could not load clinic list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cid = user?.clinic_id;
    if (!cid) {
      setValue(undefined);
      return;
    }
    if (!options.length) {
      setValue(cid);
      return;
    }
    const opt = options.find((o) => o.branch_clinic_ids.includes(cid));
    setValue(opt ? opt.clinic_id : cid);
  }, [user?.clinic_id, options]);

  async function save() {
    setLoading(true);
    try {
      await updateClinic(value ?? null);
      message.success("Clinic membership updated.");
    } catch (e: unknown) {
      const d = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(typeof d === "string" ? d : "Could not save.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        <BankOutlined style={{ marginRight: 10 }} />
        Clinic membership
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Only clinics with an admin-approved veterinarian appear here. Pets from owners who select the same clinic are visible only to that clinic's assigned veterinarians. Branches in the same network are listed in one row."
      />
      <Card>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Typography.Text type="secondary">Current clinic</Typography.Text>
            <div style={{ fontWeight: 600 }}>{user?.clinic_name || "— not selected —"}</div>
          </div>
          {options.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              message="No clinics are open for selection yet"
              description="A clinic becomes selectable only after its veterinarian (clinic owner) is approved by an administrator. Please check back later."
            />
          ) : (
            <div>
              <Typography.Text>Clinic you want to join</Typography.Text>
              <Select
                style={{ width: "100%", marginTop: 8 }}
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select a clinic or network"
                value={value}
                onChange={(v) => setValue(v)}
                options={selectOptions}
                optionRender={(opt) => {
                  const row = options.find((o) => o.clinic_id === opt.value);
                  return (
                    <div>
                      <div>{opt.label}</div>
                      {row?.subtitle ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                          {row.subtitle}
                        </Typography.Text>
                      ) : null}
                    </div>
                  );
                }}
              />
            </div>
          )}
          <Button type="primary" onClick={() => void save()} loading={loading} disabled={options.length === 0}>
            Save
          </Button>
        </Space>
      </Card>
    </div>
  );
};
