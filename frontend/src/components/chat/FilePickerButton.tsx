import { type FC, useRef } from 'react';
import { PaperClipOutlined } from '@ant-design/icons';

interface FilePickerButtonProps {
  onFilesSelected: (files: FileList) => void;
  disabled: boolean;
}

export const FilePickerButton: FC<FilePickerButtonProps> = ({ onFilesSelected, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

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
        title="添加附件"
        aria-label="添加附件"
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
