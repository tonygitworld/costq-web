import { type FC, useRef } from 'react';
import { PaperClipOutlined } from '@ant-design/icons';
import { useI18n } from '../../hooks/useI18n';

interface FilePickerButtonProps {
  onFilesSelected: (files: FileList) => void;
  disabled: boolean;
}

export const FilePickerButton: FC<FilePickerButtonProps> = ({ onFilesSelected, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n('chat');

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
    // Reset so same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        className="icon-btn"
        onClick={handleClick}
        disabled={disabled}
        title={t('attachment.addAttachment')}
        aria-label={t('attachment.addAttachment')}
      >
        <PaperClipOutlined style={{ fontSize: 18 }} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,.xlsx,.xls"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </>
  );
};
