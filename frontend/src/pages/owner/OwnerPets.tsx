import React, { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import { PlusOutlined, MedicineBoxOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const CARD_COLORS = [
  "#0d9488", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4",
  "#22c55e", "#e11d48", "#64748b", "#f97316", "#14b8a6",
];

const AVATAR_EMOJIS = [
  { value: "🐕", label: "🐕 Dog" },
  { value: "🐈", label: "🐈 Cat" },
  { value: "🐹", label: "🐹 Hamster" },
  { value: "🐰", label: "🐰 Rabbit" },
  { value: "🐦", label: "🐦 Bird" },
  { value: "🐠", label: "🐠 Fish" },
  { value: "🐢", label: "🐢 Turtle" },
  { value: "🦎", label: "🦎 Reptile" },
  { value: "🐷", label: "🐷 Other" },
];

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
  card_color?: string | null;
  avatar_emoji?: string | null;
  image_url?: string | null;
}

const DEFAULT_IMAGE_BRITISH =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/British_Shorthair_Cat.jpg/320px-British_Shorthair_Cat.jpg";
const DEFAULT_IMAGE_SCOTTISH =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Scottish_Fold_Cat.jpg/320px-Scottish_Fold_Cat.jpg";

function getPetImageUrl(pet: Pet): string | null {
  if (pet.image_url && (pet.image_url.startsWith("http://") || pet.image_url.startsWith("https://")))
    return pet.image_url;
  const breed = (pet.breed || "").toLowerCase();
  if (breed.includes("british")) return DEFAULT_IMAGE_BRITISH;
  if (breed.includes("scottish")) return DEFAULT_IMAGE_SCOTTISH;
  return null;
}

type VaccineRow = { vaccine_type: string; status: "done" | "planned"; vaccinated_at: string };

function normDate(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function getPetDisplayEmoji(pet: Pet): string {
  if (pet.avatar_emoji) return pet.avatar_emoji;
  const s = (pet.species || "").toLowerCase();
  if (s.includes("dog")) return "🐕";
  if (s.includes("cat")) return "🐈";
  return "🐾";
}

export const OwnerPets: React.FC = () => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [vaccineTypes, setVaccineTypes] = useState<VaccineType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [form] = Form.useForm();
  const [vaccineRows, setVaccineRows] = useState<VaccineRow[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

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
          card_color: p.card_color || CARD_COLORS[0],
          avatar_emoji: p.avatar_emoji || undefined,
          image_url: p.image_url || undefined,
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
      form.setFieldsValue({ card_color: CARD_COLORS[0] });
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
      card_color: values.card_color || null,
      avatar_emoji: values.avatar_emoji || null,
      vaccine_history: vaccineRows
        .filter((r) => r.vaccine_type)
        .filter((r) => r.status !== "done" || r.vaccinated_at)
        .map((r) => ({
          vaccine_type: r.vaccine_type,
          status: r.status,
          vaccinated_at: r.vaccinated_at || null,
        })),
      image_url: values.image_url?.trim() || null,
    };
    if (editingPet) {
      await api.put(`/pets/${editingPet.id}`, payload);
      message.success("Record updated. All data including vaccine info has been saved.");
    } else {
      await api.post("/pets", payload);
      message.success("Pet added.");
    }
    setModalOpen(false);
    await loadPets();
  }

  return (
    <div className="page-head">
      <Title level={3} style={{ marginBottom: 4 }}>
        My Pets
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Add pets and manage them with name, species, breed, age and notes. Track vaccine history.
      </Text>

      <div style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openModal()}>
          New Pet
        </Button>
      </div>

      {loading ? (
        <Card loading style={{ borderRadius: 16 }} />
      ) : pets.length === 0 ? (
        <Card
          style={{
            borderRadius: 16,
            textAlign: "center",
            padding: 48,
            background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
            border: "none",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐾</div>
          <Title level={4} style={{ color: "var(--text-heading)" }}>No pets added yet</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
            Get started by adding your first pet.
          </Text>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openModal()}>
            Add Pet
          </Button>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {pets.map((pet) => {
            const bg = pet.card_color || CARD_COLORS[0];
            const emoji = getPetDisplayEmoji(pet);
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={pet.id}>
                <Card
                  hoverable
                  onClick={() => openModal(pet)}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                  bodyStyle={{ padding: 0 }}
                >
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${bg} 0%, ${bg}dd 100%)`,
                      padding: "20px 20px 16px",
                      color: "#fff",
                    }}
                  >
                    <div
                      className="pet-card-avatar"
                      style={{
                        background: "rgba(255,255,255,0.3)",
                        marginBottom: 12,
                        overflow: "hidden",
                      }}
                    >
                      {getPetImageUrl(pet) ? (
                        <img
                          src={getPetImageUrl(pet)!}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            const fallback = (e.target as HTMLImageElement).parentElement?.querySelector(".pet-emoji-fallback");
                            if (fallback) (fallback as HTMLElement).style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className="pet-emoji-fallback"
                        style={{
                          display: getPetImageUrl(pet) ? "none" : "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                          fontSize: 28,
                        }}
                      >
                        {emoji}
                      </span>
                    </div>
                    <Title level={5} style={{ color: "#fff", margin: 0, fontWeight: 700 }}>
                      {pet.name}
                    </Title>
                    <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13 }}>
                      {pet.species}
                      {pet.breed ? ` · ${pet.breed}` : ""}
                    </Text>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text type="secondary">Weight</Text>
                      <Text strong>{pet.weight_kg != null ? `${pet.weight_kg} kg` : "—"}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text type="secondary">Vaccine records</Text>
                      <Text strong>{(pet.vaccine_history || []).length} record(s)</Text>
                    </div>
                    <Button type="primary" ghost block icon={<EditOutlined />} style={{ marginTop: 12 }} onClick={(e) => { e.stopPropagation(); openModal(pet); }}>
                      Edit
                    </Button>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal
        title={editingPet ? "Edit Pet" : "New Pet"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Save"
        cancelText="Cancel"
        width={680}
        confirmLoading={modalLoading}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Form layout="vertical" form={form} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}>
                <Input placeholder="e.g. Max" size="large" maxLength={100} showCount />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="species" label="Species" rules={[{ required: true, message: "Species is required" }]}>
                <Input placeholder="Dog, Cat, etc." size="large" maxLength={50} showCount />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Personalization">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div>
                <Text type="secondary" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Card color</Text>
                <Form.Item name="card_color" noStyle>
                  <Select
                    style={{ width: "100%" }}
                    options={CARD_COLORS.map((c) => ({
                      value: c,
                      label: (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, background: c, flexShrink: 0 }} />
                          <span>{c}</span>
                        </span>
                      ),
                    }))}
                  />
                </Form.Item>
              </div>
              <div>
                <Text type="secondary" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>Profile emoji</Text>
                <Form.Item name="avatar_emoji" noStyle>
                  <Select
                    placeholder="Select emoji"
                    allowClear
                    options={AVATAR_EMOJIS}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              </div>
            </Space>
          </Form.Item>

          <Form.Item name="image_url" label="Image URL (optional)">
            <Input placeholder="https://... (only http/https allowed)" maxLength={2000} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="breed" label="Breed">
                <Input placeholder="e.g. Golden Retriever, British Shorthair, Scottish Fold" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="sex" label="Sex">
                <Select placeholder="Select" allowClear options={[{ value: "M", label: "Male" }, { value: "F", label: "Female" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="date_of_birth" label="Birth date">
                <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="weight_kg" label="Weight (kg)">
                <InputNumber min={0} max={500} step={0.1} style={{ width: "100%" }} placeholder="e.g. 12.5" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="microchip" label="Microchip number">
            <Input placeholder="15-digit number" maxLength={50} />
          </Form.Item>

          <Divider plain>
            <MedicineBoxOutlined /> Vaccine history
          </Divider>
          <Card size="small" style={{ marginBottom: 16, background: "#f8fafc", borderRadius: 12 }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Select vaccine types below, then enter status and date.
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
            <Input.TextArea rows={3} placeholder="Additional notes, special info..." maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
