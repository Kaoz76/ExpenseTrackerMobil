import React from 'react';
import { FaShoppingCart, FaSave, FaPlus, FaCheck, FaTimes, FaTrash, FaPen } from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';
import { useCurrency, CURRENCY_MAP } from '../../context/CurrencyContext';

function ReceiptItemList({
  receipt,
  items,
  itemsTotal,
  hasChanges,
  saving,
  handleSaveItems,
  showAddForm,
  setShowAddForm,
  newItem,
  setNewItem,
  handleAddItem,
  editingItemIdx,
  setEditingItemIdx,
  handleItemChange,
  handleRemoveItem
}) {
  const { t } = useLanguage();
  const { formatPrice, currency } = useCurrency();

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-body-tertiary py-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
          <FaShoppingCart className="me-2 text-body-secondary" /> {t('common.parsed_items')}
        </h5>
        <div className="d-flex gap-2">
          {hasChanges && (
            <button
              className="btn btn-success btn-sm d-flex align-items-center gap-1"
              onClick={handleSaveItems}
              disabled={saving}
            >
              <FaSave /> {saving ? t('common.saving') : t('common.save_changes')}
            </button>
          )}
          <button
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            onClick={() => setShowAddForm(true)}
          >
            <FaPlus /> {t('common.add_item')}
          </button>
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="p-3 bg-primary-subtle border-bottom">
          <h6 className="fw-bold mb-3 text-primary">{t('common.add_new_item')}</h6>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small fw-bold">{t('common.name_star')}</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder={t('common.placeholder_item_name')}
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold">{t('common.type')}</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={newItem.type}
                onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold">{t('common.brand')}</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={newItem.brand}
                onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold">{t('common.size')}</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={newItem.size}
                onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold">{t('common.price')}</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text">{CURRENCY_MAP[receipt?.currency || currency?.code || 'USD']?.symbol || '$'}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-control form-control-sm"
                  placeholder="0.00"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value.replace(/[^0-9.,]/g, '') })}
                />
              </div>
            </div>
            <div className="col-12 col-md-1 d-flex gap-1 mt-2 mt-md-0">
              <button
                className="btn btn-success btn-sm flex-grow-1 px-1"
                onClick={handleAddItem}
                disabled={!newItem.name.trim()}
                title={t('common.add_action')}
              >
                <FaCheck />
              </button>
              <button
                className="btn btn-outline-secondary btn-sm px-1"
                onClick={() => {
                  setShowAddForm(false);
                  setNewItem({ name: '', price: '', brand: '', type: '', size: '' });
                }}
                title={t('common.cancel')}
              >
                <FaTimes />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE LIST VIEW */}
      <div className="d-md-none border rounded bg-light mb-3">
        <div className="list-group list-group-flush">
          {items.map((item, idx) => (
            <div key={idx} className={`list-group-item bg-transparent py-3 ${editingItemIdx === idx ? 'border-primary' : ''}`}>
              {editingItemIdx === idx ? (
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="badge bg-secondary text-white">#{idx + 1}</span>
                    <div>
                      <button className="btn btn-sm btn-success me-1" onClick={() => setEditingItemIdx(null)}><FaCheck /></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveItem(idx)}><FaTrash /></button>
                    </div>
                  </div>
                  <input type="text" className="form-control form-control-sm" value={item.name || ''} onChange={(e) => handleItemChange(idx, 'name', e.target.value)} placeholder={t('common.name')} />
                  <div className="row g-2">
                    <div className="col-12"><input type="text" className="form-control form-control-sm" placeholder={t('common.type')} value={item.type || ''} onChange={(e) => handleItemChange(idx, 'type', e.target.value)} /></div>
                    <div className="col-6"><input type="text" className="form-control form-control-sm" placeholder={t('common.brand')} value={item.brand || ''} onChange={(e) => handleItemChange(idx, 'brand', e.target.value)} /></div>
                    <div className="col-6"><input type="text" className="form-control form-control-sm" placeholder={t('common.size')} value={item.size || ''} onChange={(e) => handleItemChange(idx, 'size', e.target.value)} /></div>
                  </div>
                  <div className="input-group input-group-sm mt-1">
                    <span className="input-group-text">{CURRENCY_MAP[receipt?.currency || currency?.code || 'USD']?.symbol || '$'}</span>
                    <input type="text" inputMode="decimal" className="form-control form-control-sm text-end" value={item.price} onChange={(e) => handleItemChange(idx, 'price', e.target.value.replace(/[^0-9.,]/g, ''))} placeholder={t('common.price')} />
                  </div>
                </div>
              ) : (
                <div className="d-flex justify-content-between align-items-start">
                  <div className="pe-2">
                    <div className="fw-bold text-wrap" style={{ wordBreak: 'break-word' }}>
                      <span className="text-muted small me-2">#{idx + 1}</span>{item.name || '-'}
                    </div>
                    <div className="text-muted small mt-1 text-wrap" style={{ wordBreak: 'break-word', lineHeight: '1.2' }}>
                      {[item.type, item.brand, item.size].filter(Boolean).join(' • ')}
                    </div>
                  </div>
                  <div className="d-flex flex-column align-items-end">
                    <div className="fw-bold text-primary mb-2" style={{ whiteSpace: 'nowrap' }}>{formatPrice(item.price, receipt?.currency)}</div>
                    <div>
                      <button className="btn btn-sm btn-outline-primary border-0 me-1" onClick={() => setEditingItemIdx(idx)} title={t('common.edit')}><FaPen size={12}/></button>
                      <button className="btn btn-sm btn-outline-danger border-0" onClick={() => handleRemoveItem(idx)} title={t('common.delete_item')}><FaTrash size={12}/></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-4 text-muted">
              <FaShoppingCart size={32} className="mb-2 opacity-50" />
              <div>{t('common.no_items_on_receipt')}</div>
              <button className="btn btn-sm btn-primary mt-2" onClick={() => setShowAddForm(true)}>
                <FaPlus className="me-1" /> {t('common.add_first_item')}
              </button>
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div className="d-flex justify-content-between align-items-center p-3 border-top bg-white rounded-bottom">
            <span className="fw-bold">{t('common.items_total')}</span>
            <span className="fw-bold fs-5 text-primary">{formatPrice(itemsTotal, receipt?.currency)}</span>
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="d-none d-md-block table-responsive">
        <table className="table table-hover mb-0 align-middle">
          <thead className="table-secondary">
            <tr>
              <th className="py-3 ps-4" style={{ width: '40px' }}>#</th>
              <th className="py-3">{t('common.name')}</th>
              <th className="py-3">{t('common.type')}</th>
              <th className="py-3">{t('common.brand')}</th>
              <th className="py-3">{t('common.size')}</th>
              <th className="py-3 text-end">{t('common.price')}</th>
              <th className="py-3 text-center pe-4" style={{ width: '100px' }}>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className={editingItemIdx === idx ? 'table-active' : ''}>
                <td className="ps-4 text-body-secondary fw-medium">{idx + 1}</td>

                {editingItemIdx === idx ? (
                  <>
                    <td>
                      <input type="text" className="form-control form-control-sm" value={item.name || ''} onChange={(e) => handleItemChange(idx, 'name', e.target.value)} />
                    </td>
                    <td>
                      <input type="text" className="form-control form-control-sm" value={item.type || ''} onChange={(e) => handleItemChange(idx, 'type', e.target.value)} />
                    </td>
                    <td>
                      <input type="text" className="form-control form-control-sm" value={item.brand || ''} onChange={(e) => handleItemChange(idx, 'brand', e.target.value)} />
                    </td>
                    <td>
                      <input type="text" className="form-control form-control-sm" value={item.size || ''} onChange={(e) => handleItemChange(idx, 'size', e.target.value)} />
                    </td>
                    <td>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">{CURRENCY_MAP[receipt?.currency || currency?.code || 'USD']?.symbol || '$'}</span>
                        <input type="text" inputMode="decimal" className="form-control form-control-sm text-end" value={item.price} onChange={(e) => handleItemChange(idx, 'price', e.target.value.replace(/[^0-9.,]/g, ''))} />
                      </div>
                    </td>
                    <td className="text-center pe-4">
                      <button className="btn btn-sm btn-success me-1" onClick={() => setEditingItemIdx(null)} title={t('common.done_editing')}><FaCheck size={12} /></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveItem(idx)} title={t('common.delete_item')}><FaTrash size={12} /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="fw-bold">{item.name || '-'}</td>
                    <td className="text-muted">{item.type || '-'}</td>
                    <td className="text-muted">{item.brand || '-'}</td>
                    <td className="text-muted">{item.size || '-'}</td>
                    <td className="text-end fw-bold text-primary">{formatPrice(item.price, receipt?.currency)}</td>
                    <td className="text-center pe-4">
                      <button className="btn btn-sm btn-outline-primary me-1 border-0" onClick={() => setEditingItemIdx(idx)} title={t('common.edit_item')}><FaPen size={12} /></button>
                      <button className="btn btn-sm btn-outline-danger border-0" onClick={() => handleRemoveItem(idx)} title={t('common.delete_item')}><FaTrash size={12} /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-5 text-body-secondary">
                  <FaShoppingCart size={32} className="mb-2 opacity-50" />
                  <div>{t('common.no_items_on_receipt')}</div>
                  <button className="btn btn-sm btn-primary mt-2" onClick={() => setShowAddForm(true)}>
                    <FaPlus className="me-1" /> {t('common.add_first_item')}
                  </button>
                </td>
              </tr>
            )}
          </tbody>

          {items.length > 0 && (
            <tfoot className="table-secondary">
              <tr>
                <td colSpan="5" className="text-end fw-bold py-3 ps-4">{t('common.items_total')}</td>
                <td className="text-end fw-bold fs-5 text-primary py-3">{formatPrice(itemsTotal, receipt?.currency)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default ReceiptItemList;
