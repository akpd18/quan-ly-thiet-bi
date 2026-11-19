import { useState } from 'react';
import { Button, Modal, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import MaintenanceHistoryTab from './MaintenanceHistoryTab.jsx';
import MaintenanceDueTab from './MaintenanceDueTab.jsx';
import { CompleteForm, StartForm } from './MaintenanceForms.jsx';
import './MaintenancePage.css';

export default function MaintenancePage() {
  // reloadKey tăng lên sau mỗi lần ghi nhận để các tab tự tải lại dữ liệu
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState({ type: null, data: null });

  const closeModal = () => setModal({ type: null, data: null });
  const handleSaved = () => {
    closeModal();
    setReloadKey((k) => k + 1);
  };

  const tabs = [
    {
      key: 'history',
      label: 'Lịch sử bảo dưỡng – sửa chữa',
      children: (
        <MaintenanceHistoryTab
          reloadKey={reloadKey}
          onComplete={(record) => setModal({ type: 'complete', data: record })}
        />
      ),
    },
    {
      key: 'due',
      label: 'Đến hạn bảo dưỡng',
      children: (
        <MaintenanceDueTab
          reloadKey={reloadKey}
          onStart={(device) =>
            setModal({ type: 'start', data: { loaiHinh: 'bao_duong', device } })
          }
        />
      ),
    },
  ];

  return (
    <section className="maintenance-page">
      <div className="maintenance-page__header">
        <h1 className="maintenance-page__title">Bảo dưỡng – sửa chữa</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModal({ type: 'start', data: null })}
        >
          Ghi nhận bảo dưỡng / sửa chữa
        </Button>
      </div>

      <Tabs items={tabs} />

      <Modal
        title="Ghi nhận bảo dưỡng / sửa chữa"
        open={modal.type === 'start'}
        onCancel={closeModal}
        footer={null}
      >
        {modal.type === 'start' && (
          <StartForm initial={modal.data} onCancel={closeModal} onSaved={handleSaved} />
        )}
      </Modal>

      <Modal
        title={modal.type === 'complete' ? `Hoàn tất ${modal.data.thietBi.maThietBi}` : ''}
        open={modal.type === 'complete'}
        onCancel={closeModal}
        footer={null}
      >
        {modal.type === 'complete' && (
          <CompleteForm record={modal.data} onCancel={closeModal} onSaved={handleSaved} />
        )}
      </Modal>
    </section>
  );
}