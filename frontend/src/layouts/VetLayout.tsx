import React, { useState } from "react";
import { Layout, Menu, Tag, Button, Drawer, Dropdown, Modal, Input } from "antd";
import {
  DashboardOutlined,
  CalendarOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  TeamOutlined,
  LogoutOutlined,
  MessageOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ErrorBoundary } from "../components/ErrorBoundary";

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "Dashboard", path: "/vet/dashboard" },
  { key: "pets", icon: <TeamOutlined />, label: "Patients", path: "/vet/pets" },
  { key: "appointments", icon: <CalendarOutlined />, label: "Appointments", path: "/vet/appointments" },
  { key: "cases", icon: <FileTextOutlined />, label: "Cases", path: "/vet/cases" },
  { key: "reports", icon: <MessageOutlined />, label: "Symptom Reports", path: "/vet/reports" },
  { key: "risk", icon: <ExperimentOutlined />, label: "Risk Analysis", path: "/vet/risk" },
];

export const VetLayout: React.FC = () => {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");

  async function saveDisplayName() {
    await updateProfile(displayName.trim() || null);
    setNameModalOpen(false);
    setDisplayName("");
  }

  const selectedKey = (() => {
    if (loc.pathname.startsWith("/vet/dashboard")) return "dashboard";
    if (loc.pathname.startsWith("/vet/pets")) return "pets";
    if (loc.pathname.startsWith("/vet/appointments")) return "appointments";
    if (loc.pathname.startsWith("/vet/cases")) return "cases";
    if (loc.pathname.startsWith("/vet/reports")) return "reports";
    if (loc.pathname.startsWith("/vet/risk")) return "risk";
    return "dashboard";
  })();

  const menuContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      style={{
        background: "transparent",
        border: "none",
        padding: "12px 16px",
        fontSize: 15,
      }}
      items={MENU_ITEMS.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: <Link to={item.path} onClick={() => setDrawerOpen(false)}>{item.label}</Link>,
      }))}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--surface-vet)" }} className="vet-layout">
      <Sider
        width={260}
        theme="dark"
        className="vet-sider layout-sider"
        style={{
          background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)",
        }}
      >
        <div className="layout-sider-brand" style={{ color: "#e0f2fe" }}>
          VetConnect
        </div>
        {menuContent}
      </Sider>

      <Layout style={{ marginLeft: 260, minHeight: "100vh" }} className="vet-main-layout">
        <Header className="layout-header">
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20 }} />}
            onClick={() => setDrawerOpen(true)}
            className="vet-menu-btn"
            style={{ display: "none" }}
          />
          <div style={{ color: "var(--text-heading)", fontWeight: 600, fontSize: 18 }}>
            Veterinary Panel
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {(user?.full_name || user?.email) && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "name",
                      icon: <UserOutlined />,
                      label: "Set display name",
                      onClick: () => {
                        setDisplayName(user?.full_name || "");
                        setNameModalOpen(true);
                      },
                    },
                  ],
                }}
                trigger={["click"]}
              >
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 6,
                  }}
                  className="vet-email"
                  title={user?.email}
                >
                  {user?.full_name || user?.email}
                </span>
              </Dropdown>
            )}
            <Tag color="blue">Vet</Tag>
            <Button
              type="primary"
              icon={<LogoutOutlined />}
              danger
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </Button>
          </div>
        </Header>
        <Content className="app-content" style={{ background: "var(--surface-vet)" }}>
          <div className="content-card">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </Content>
      </Layout>

      <Modal
        title="Display name"
        open={nameModalOpen}
        onCancel={() => setNameModalOpen(false)}
        onOk={saveDisplayName}
        okText="Save"
      >
        <p style={{ marginBottom: 8, color: "var(--text-secondary)" }}>
          This name is shown in the top bar instead of your email.
        </p>
        <Input
          placeholder="e.g. Emirhan Demircan"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onPressEnter={saveDisplayName}
        />
      </Modal>

      <Drawer
        title="VetConnect"
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        bodyStyle={{ padding: 0, background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)" }}
        headerStyle={{ borderBottom: "1px solid rgba(255,255,255,0.12)", color: "#e0f2fe" }}
        className="vet-drawer"
      >
        {menuContent}
      </Drawer>

      <style>{`
        @media (max-width: 991px) {
          .vet-sider { display: none !important; }
          .vet-main-layout { margin-left: 0 !important; }
          .vet-menu-btn { display: inline-flex !important; }
          .vet-email { display: none; }
        }
        .vet-sider .ant-menu-item-selected { background: rgba(13, 148, 136, 0.35) !important; }
        .vet-sider .ant-menu-item:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>
    </Layout>
  );
};
