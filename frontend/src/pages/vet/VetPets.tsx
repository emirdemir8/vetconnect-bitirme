import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, MedicineBoxOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

interface VaccineType {
  id: string;
  name: string;
}

interface VaccineEntry {
  vaccine_type: string;
  status?: "done" | "planned";
  vaccinated_at?: string | null;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  sex?: string | null;
  date_of_birth?: string | null;
  weight_kg?: number | null;
  microchip?: string | null;
  vaccine_history?: VaccineEntry[];
  notes?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
}

type VaccineRow = { vaccine_type: string; status: "done" | "planned"; vaccinated_at: string };

function normDate(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export const VetPets: React.FC = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [form] = Form.useForm();
  const [vaccineRows, setVaccineRows] = useState<VaccineRow[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const filteredPets = searchText.trim()
    ? pets.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(searchText.trim().toLowerCase()) ||
          (p.species || "").toLowerCase().includes(searchText.trim().toLowerCase()) ||
          (p.breed || "").toLowerCase().includes(searchText.trim().toLowerCase()) ||
          (p.owner_name || "").toLowerCase().includes(searchText.trim().toLowerCase())
      )
    : pets;

  async function loadPets() {
    setLoading(true);
    try {
      const res = await api.get<Pet[]>("/pets");
      setPets(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadVaccineTypes() {
    try {
      const res = await api.get<{ items: VaccineType[] }>("/vaccine-types");
      setVaccineTypes(res.data.items || []);
    } catch {
      setVaccineTypes([
        { id: "rabies", name: "Rabies" },
        { id: "dhpp", name: "DHPP (Dog)" },
        { id: "fvrcp", name: "FVRCP (Cat)" },
        { id: "lyme", name: "Lyme" },
      ]);
    }
  }

  useEffect(() => {
    loadPets();
    loadVaccineTypes();
  }, []);

  async function openModal(pet?: Pet) {
    setEditingPet(pet || null);
    form.resetFields();
    if (pet?.id) {
      setModalLoading(true);
      try {
        const res = await api.get<Pet>(`/pets/${pet.id}`);
        const p = res.data;
        form.setFieldsValue({
          name: p.name,
          species: p.species,
          breed: p.breed,
          sex: p.sex,
          date_of_birth: p.date_of_birth ? dayjs(normDate(p.date_of_birth)) : null,
          weight_kg: p.weight_kg,
          microchip: p.microchip,
          notes: p.notes,
        });
        setVaccineRows(
          (p.vaccine_history || []).map((e) => ({
            vaccine_type: e.vaccine_type,
            status: (e.status === "planned" ? "planned" : "done") as "done" | "planned",
            vaccinated_at: normDate(e.vaccinated_at ?? undefined),
          }))
        );
      } finally {
        setModalLoading(false);
      }
    } else {
      setVaccineRows([]);
    }
    setModalOpen(true);
  }

  function getRow(vaccineTypeId: string): VaccineRow | undefined {
    return vaccineRows.find((r) => r.vaccine_type === vaccineTypeId);
  }

  function selectVaccineType(vaccineTypeId: string, selected: boolean) {
    if (selected) {
      setVaccineRows((r) => {
        if (r.some((x) => x.vaccine_type === vaccineTypeId)) return r;
        return [...r, { vaccine_type: vaccineTypeId, status: "done" as const, vaccinated_at: "" }];
      });
    } else {
      setVaccineRows((r) => r.filter((x) => x.vaccine_type !== vaccineTypeId));
    }
  }

  function selectAllVaccineTypes() {
    const existing = new Set(vaccineRows.map((x) => x.vaccine_type));
    const toAdd = vaccineTypes.filter((t) => !existing.has(t.id));
    setVaccineRows((r) => [
      ...r,
      ...toAdd.map((t) => ({ vaccine_type: t.id, status: "done" as const, vaccinated_at: "" })),
    ]);
  }

  function updateVaccineRowByType(vaccineTypeId: string, field: keyof VaccineRow, value: string) {
    setVaccineRows((r) =>
      r.map((x) => (x.vaccine_type === vaccineTypeId ? { ...x, [field]: value } : x))
    );
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    const payload = {
      name: values.name,
      species: values.species,
      breed: values.breed || null,
      sex: values.sex || null,
      date_of_birth: values.date_of_birth ? values.date_of_birth.format("YYYY-MM-DD") : null,
      weight_kg: values.weight_kg ?? null,
      microchip: values.microchip || null,
      notes: values.notes || null,
      vaccine_history: vaccineRows
        .filter((r) => r.vaccine_type)
        .filter((r) => r.status !== "done" || r.vaccinated_at)
        .map((r) => ({
          vaccine_type: r.vaccine_type,
          status: r.status,
          vaccinated_at: r.vaccinated_at || null,
        })),
    };
    if (editingPet) {
      await api.put(`/pets/${editingPet.id}`, payload);
    } else {
      await api.post("/pets", payload);
    }
    setModalOpen(false);
    loadPets();
  }

  async function handleDelete(pet: Pet) {
    Modal.confirm({
      title: "Delete record",
      content: `Are you sure you want to delete ${pet.name}?`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        await api.delete(`/pets/${pet.id}`);
        loadPets();
      },
    });
  }

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (t: string) => <Text strong>{t}</Text>,
    },
    {
      title: "Owner",
      key: "owner",
      render: (_: unknown, pet: Pet) => (
        <span>{pet.owner_name || "—"}</span>
      ),
    },
    {
      title: "Species",
      dataIndex: "species",
      key: "species",
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    { title: "Breed", dataIndex: "breed", key: "breed" },
    { title: "Sex", dataIndex: "sex", key: "sex" },
    {
      title: "Weight",
      dataIndex: "weight_kg",
      key: "weight_kg",
      render: (v: number | null) => (v != null ? `${v} kg` : "—"),
    },
    {
      title: "Vaccines",
      key: "vaccines",
      render: (_: unknown, pet: Pet) => (
        <Text type="secondary">{(pet.vaccine_history || []).length} record(s)</Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, pet: Pet) => (
        <Space>
          <Button size="small" onClick={() => openModal(pet)}>
            Edit
          </Button>
          <Button size="small" danger onClick={() => handleDelete(pet)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Title level={3} style={{ marginBottom: 4 }}>
        Patients
      </Title>
      <Text type="secondary">
        View and edit animal records. Update vaccine history (done / planned) here.
      </Text>

      <Card
        style={{ marginTop: 16, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        bodyStyle={{ padding: 16 }}
        extra={
          <Space wrap>
            <Input
              placeholder="Search by name, species, breed"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 260 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Add Patient
            </Button>
          </Space>
        }
      >
        <Table rowKey="id" loading={loading} dataSource={filteredPets} columns={columns} size="middle" />
      </Card>

      <Modal
        title={editingPet ? "Edit Patient" : "New Patient"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Save"
        cancelText="Cancel"
        width={680}
        confirmLoading={modalLoading}
      >
        <Form layout="vertical" form={form} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="e.g. Max" />
          </Form.Item>
          <Form.Item
            name="species"
            label="Species"
            rules={[{ required: true, message: "Species is required" }]}
          >
            <Input placeholder="Dog, Cat, etc." />
          </Form.Item>
          <Form.Item name="breed" label="Breed">
            <Input placeholder="e.g. Golden Retriever" />
          </Form.Item>
          <Form.Item name="sex" label="Sex">
            <Select
              placeholder="Select"
              allowClear
              options={[
                { value: "M", label: "Male" },
                { value: "F", label: "Female" },
              ]}
            />
          </Form.Item>
          <Form.Item name="date_of_birth" label="Birth date">
            <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="weight_kg" label="Weight (kg)">
            <InputNumber
              min={0}
              max={500}
              step={0.1}
              style={{ width: "100%" }}
              placeholder="e.g. 12.5"
            />
          </Form.Item>
          <Form.Item name="microchip" label="Microchip number">
            <Input placeholder="15-digit number" />
          </Form.Item>

          <Divider plain>
            <MedicineBoxOutlined /> Vaccine history (done / planned)
          </Divider>
          <Card size="small" style={{ marginBottom: 16, background: "#f8fafc", borderRadius: 12 }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Select vaccine types, then enter status and date.
              </Text>
              <Button size="small" type="primary" ghost onClick={selectAllVaccineTypes}>
                Select all
              </Button>
            </div>
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              {vaccineTypes.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>Loading vaccine types...</Text>
              ) : (
                vaccineTypes.map((t) => {
                  const row = getRow(t.id);
                  const selected = !!row;
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 0",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <Checkbox
                        checked={selected}
                        onChange={(e) => selectVaccineType(t.id, e.target.checked)}
                      />
                      <span style={{ minWidth: 160, fontWeight: 500 }}>{t.name}</span>
                      {selected && row && (
                        <>
                          <Select
                            placeholder="Status"
                            value={row.status}
                            onChange={(v) => updateVaccineRowByType(t.id, "status", v || "done")}
                            options={[
                              { value: "done", label: "Done" },
                              { value: "planned", label: "Planned" },
                            ]}
                            style={{ width: 120 }}
                          />
                          <DatePicker
                            format="DD.MM.YYYY"
                            value={row.vaccinated_at ? dayjs(row.vaccinated_at) : null}
                            onChange={(date) =>
                              updateVaccineRowByType(t.id, "vaccinated_at", date ? date.format("YYYY-MM-DD") : "")
                            }
                            placeholder={row.status === "planned" ? "Planned date" : "Date"}
                            style={{ width: 140 }}
                          />
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Additional notes" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
