import React from 'react';
import { useI18n } from '../i18n';

interface ApprovalDialogProps {
  steps: Array<{ description?: string; type?: string; files?: string[]; command?: string; danger_level?: number }>;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}

const IconShield = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fdcb6e" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function ApprovalDialog({ steps, onApprove, onReject, loading }: ApprovalDialogProps) {
  const { t } = useI18n();

  return (
    <div className="modal-overlay">
      <div className="modal approval-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><IconShield /> {t('approvalTitle')}</h2>
        </div>
        <div className="modal-body">
          <p className="approval-desc">{t('approvalDesc')}</p>
          <div className="approval-steps">
            {steps.map((step, i) => (
              <div key={i} className={`approval-step ${step.danger_level && step.danger_level > 1 ? 'danger' : ''}`}>
                <div className="step-type">
                  {step.type === 'file_edit' && '📝'}
                  {step.type === 'delete' && '🗑️'}
                  {step.type === 'command' && '⚡'}
                  {step.type || '❓'}
                </div>
                <div className="step-info">
                  <div className="step-desc">{step.description || t('approvalUnknownStep')}</div>
                  {step.files && step.files.length > 0 && (
                    <div className="step-files">
                      {step.files.map((f, j) => <code key={j}>{f}</code>)}
                    </div>
                  )}
                  {step.command && (
                    <div className="step-command">
                      <code>$ {step.command}</code>
                    </div>
                  )}
                  {step.danger_level && step.danger_level > 1 && (
                    <div className="step-danger">{t('approvalDanger')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onReject} disabled={loading}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary" onClick={onApprove} disabled={loading}>
            {loading ? t('approvalExecuting') : t('approvalExecute')}
          </button>
        </div>
      </div>
    </div>
  );
}
