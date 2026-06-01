import React, { useState } from "react";
import { Layout, Menu, Tag, Button, Drawer } from "antd";
import { AuditOutlined, LogoutOutlined, MenuOutlined } from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: "applications", icon: <AuditOutlined />, label: "Vet applications", path: "/admin/applications" },
];

export const AdminLayout: React.FC = () => {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedKey = loc.pathname.startsWith("/admin/applications") ? "applications" : "applications";

  const menuContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      style={{ background: "transparent", border: "none", padding: "12px 16px", fontSize: 15 }}
      items={MENU_ITEMS.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: (
          <Link to={item.path} onClick={() => setDrawerOpen(false)}>
            {item.label}
          </Link>
        ),
      }))}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--surface-2)" }} className="admin-layout">
      <Sider
        width={260}
        theme="dark"
        className="layout-sider"
        style={{ background: "linear-gradient(180deg, #4c1d95 0%, #2e1065 100%)" }}
      >
        <div className="layout-sider-brand" style={{ color: "#ede9fe" }}>
          Admin
        </div>
        {menuContent}
      </Sider>

      <Layout style={{ marginLeft: 260, minHeight: "100vh" }}>
        <Header className="layout-header">
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20 }} />}
            onClick={() => setDrawerOpen(true)}
            className="admin-menu-btn"
            style={{ display: "none" }}
          />
          <div style={{ color: "var(--text-heading)", fontWeight: 600, fontSize: 18 }}>
            Admin dashboard
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--text-secondary)", fontSize: 14 }} title={user?.email}>
              {user?.email}
            </span>
            <Tag color="purple">Admin</Tag>
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
          <div className="content-card">
            <Outlet />
          </div>
        </Content>
      </Layout>

      <Drawer
        title="Admin"
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        bodyStyle={{ padding: 0, background: "linear-gradient(180deg, #4c1d95 0%, #2e1065 100%)" }}
        headerStyle={{ borderBottom: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
        className="admin-drawer"
      >
        {menuContent}
      </Drawer>

      <style>{`
        @media (max-width: 991px) {
          .admin-layout .ant-layout-sider { display: none !important; }
          .admin-layout .ant-layout { margin-left: 0 !important; }
          .admin-menu-btn { display: inline-flex !important; }
        }
        .admin-layout .ant-menu-item-selected { background: rgba(255,255,255,0.2) !important; }
        .admin-layout .ant-menu-item:hover { background: rgba(255,255,255,0.1) !important; }
      `}</style>
    </Layout>
  );
};
