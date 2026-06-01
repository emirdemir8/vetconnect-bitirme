import React from "react";
import { Form, Input, Modal, message } from "antd";
import { useAuth } from "../context/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const { changePassword } = useAuth();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = React.useState(false);

  function handleClose() {
    form.resetFields();
    onClose();
  }

  async function onOk() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(values.old_password, values.new_password);
      message.success("Your password has been changed.");
      handleClose();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((x: { msg?: string }) => x?.msg || String(x)).join(" ")
        : typeof detail === "string"
          ? detail
          : "Could not change password.";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Change password"
      open={open}
      onCancel={handleClose}
      onOk={() => void onOk()}
      okText="Change password"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="old_password"
          label="Current password"
          rules={[{ required: true, message: "Enter your current password." }]}
        >
          <Input.Password placeholder="Current password" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label="New password"
          rules={[
            { required: true, message: "Enter a new password." },
            { min: 8, message: "At least 8 characters." },
            {
              validator: (_, v) =>
                !v || (/[A-Za-z]/.test(v) && /\d/.test(v))
                  ? Promise.resolve()
                  : Promise.reject(new Error("Must include at least one letter and one number.")),
            },
          ]}
        >
          <Input.Password placeholder="At least 8 chars, a letter and a number" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="Confirm new password"
          dependencies={["new_password"]}
          rules={[
            { required: true, message: "Confirm your new password." },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                !v || v === getFieldValue("new_password")
                  ? Promise.resolve()
                  : Promise.reject(new Error("Passwords do not match.")),
            }),
          ]}
        >
          <Input.Password placeholder="Repeat new password" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
