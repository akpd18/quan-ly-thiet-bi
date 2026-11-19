import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Table, Tag } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { apiRequest } from '../../services/api.js';
import { TinhTrangTag, TrangThaiTag } from '../../components/StatusTag/StatusTag.jsx';
import { formatDate } from '../../utils/format.js';

export default function MaintenanceDueTab({ reloadKey, onStart }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState({
    key: null,
    items: [],
    total: 0,
    soNgayCanhBao: 7,
    error: '',
  });

  const requestKey = `${page}|${pageSize}|${reloadKey}`;

  useEffect(() => {
    let ignore = false;
    apiRequest(`/api/maintenance/due?page=${page}&pageSize=${pageSize}`)
      .then((res) => {
        if (!ignore) {
          setResult({
            key: requestKey,
            items: res.items,
            total: res.total,
            soNgayCanhBao: res.soNgayCanhBao,
            error: '',
          });
        }
      })
      .catch((err) => {
        if (!ignore) {
          setResult((prev) => ({ ...prev, key: requestKey, items: [], total: 0, error: err.message }));
        }
      });
    return () => {
      ignore = true;
    };
  }, [page, pageSize, requestKey]);

  const loading = result.key !== requestKey;

  const columns = [
    {
      title: 'Thiết bị',
      render: (_, row) => (
        <div>
          <Link to={`/thiet-bi/${row.id}`}>{row.maThietBi}</Link>
          <div className="maintenance-page__muted">{row.tenThietBi}</div>
        </div>
      ),
    },
    { title: 'Loại', dataIndex: 'tenLoai' },
    { title: 'Phòng ban', dataIndex: 'tenPhongBan' },
    {
      title: 'Tình trạng',
      dataIndex: 'tinhTrang',
      render: (value) => <TinhTrangTag value={value} />,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trangThai',
      render: (value) => <TrangThaiTag value={value} />,
    },
    {
      title: 'Chu kỳ',
      dataIndex: 'chuKyBaoDuongThang',
      render: (value) => `${value} tháng`,
    },
    {
      title: 'Hạn bảo dưỡng',
      dataIndex: 'hanBaoDuong',
      render: (value, row) => (
        <span>
          {formatDate(value)}{' '}
          {row.quaHan ? <Tag color="error">Quá hạn</Tag> : <Tag color="warning">Sắp đến hạn</Tag>}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      render: (_, row) => {
        const canStart = row.trangThai === 'san_sang';
        return (
          <span title={canStart ? undefined : 'Thiết bị đang được mượn, chờ trả rồi mới bảo dưỡng'}>
            <Button
              size="small"
              type="primary"
              icon={<ToolOutlined />}
              disabled={!canStart}
              onClick={() => onStart(row)}
            >
              Bảo dưỡng
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <Alert
        className="maintenance-page__alert"
        type="info"
        showIcon
        message={`Danh sách thiết bị đã quá hạn hoặc còn ${result.soNgayCanhBao} ngày nữa đến hạn bảo dưỡng. Hạn bảo dưỡng là ngày bảo dưỡng kế tiếp của lần bảo dưỡng thành công gần nhất; thiết bị chưa từng bảo dưỡng thì tính từ ngày nhập cộng chu kỳ của loại thiết bị.`}
      />

      {result.error && (
        <Alert className="maintenance-page__alert" type="error" showIcon message={result.error} />
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={result.items}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total: result.total,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} thiết bị`,
        }}
        onChange={(pagination) => {
          setPage(pagination.current);
          setPageSize(pagination.pageSize);
        }}
      />
    </div>
  );
}