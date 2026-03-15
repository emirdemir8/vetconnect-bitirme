import React, { useState } from "react";
import { Layout, Menu, Tag, Button, Drawer, Dropdown, Modal, Input } from "antd";
import {
  HomeOutlined,
  HeartOutlined,
  CalendarOutlined,
  HistoryOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: "dashboard", icon: <HomeOutlined />, label: "Dashboard", path: "/owner/dashboard" },
  { key: "pets", icon: <HeartOutlined />, label: "My Pets", path: "/owner/pets" },
  { key: "appointments", icon: <CalendarOutlined />, label: "Book Appointment", path: "/owner/appointments" },
  { key: "check", icon: <HistoryOutlined />, label: "Report Symptom", path: "/owner/check" },
  { key: "history", icon: <FileTextOutlined />, label: "History", path: "/owner/history" },
];

export const OwnerLayout: React.FC = () => {
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
    if (loc.pathname.startsWith("/owner/dashboard")) return "dashboard";
    if (loc.pathname.startsWith("/owner/pets")) return "pets";
    if (loc.pathname.startsWith("/owner/appointments")) return "appointments";
    if (loc.pathname.startsWith("/owner/check")) return "check";
    if (loc.pathname.startsWith("/owner/history")) return "history";
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
    <Layout style={{ minHeight: "100vh", background: "var(--surface-2)" }} className="owner-layout">
      <Sider
        width={260}
        theme="dark"
        className="owner-sider layout-sider"
        style={{
          background: "linear-gradient(180deg, #0d9488 0%, #0f766e 100%)",
        }}
      >
        <div className="layout-sider-brand" style={{ color: "#fff" }}>
          🐾 Paws & Care
        </div>
        {menuContent}
      </Sider>

      <Layout style={{ marginLeft: 260, minHeight: "100vh" }} className="owner-main-layout">
        <Header className="layout-header">
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20 }} />}
            onClick={() => setDrawerOpen(true)}
            className="owner-menu-btn"
            style={{ display: "none" }}
          />
          <div style={{ color: "var(--text-heading)", fontWeight: 600, fontSize: 18 }}>
            Pet Owner Panel
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
                  className="owner-email"
                  title={user?.email}
                >
                  {user?.full_name || user?.email}
                </span>
              </Dropdown>
            )}
            <Tag color="cyan">Owner</Tag>
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
        <Content className="app-content" style={{ background: "var(--surface-2)" }}>
          <div
            className="content-card"
            style={{
              background: loc.pathname === "/owner/dashboard" ? "transparent" : undefined,
              boxShadow: loc.pathname === "/owner/dashboard" ? "none" : undefined,
              border: loc.pathname === "/owner/dashboard" ? "none" : undefined,
              padding: loc.pathname === "/owner/dashboard" ? 0 : undefined,
            }}
          >
            <Outlet />
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
        title="🐾 Paws & Care"
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        bodyStyle={{ padding: 0, background: "linear-gradient(180deg, #0d9488 0%, #0f766e 100%)" }}
        headerStyle={{ borderBottom: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
        className="owner-drawer"
      >
        {menuContent}
      </Drawer>

      <style>{`
        @media (max-width: 991px) {
          .owner-sider { display: none !important; }
          .owner-main-layout { margin-left: 0 !important; }
          .owner-menu-btn { display: inline-flex !important; }
          .owner-email { display: none; }
        }
        .owner-sider .ant-menu-item-selected { background: rgba(255,255,255,0.2) !important; }
        .owner-sider .ant-menu-item:hover { background: rgba(255,255,255,0.1) !important; }
      `}</style>
    </Layout>
  );
};
