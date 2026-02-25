import { type FC, useRef } from 'react';
import { PictureOutlined } from '@ant-design/icons';

interface ImagePickerButtonProps {
  onFilesSelected: (files: FileList) => void;
  disabled: boolean;
}

export const ImagePickerButton: FC<ImagePickerButtonProps> = ({ onFilesSelected, disabled }) => {
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
        title="添加图片"
        aria-label="添加图片"
      >
        <PictureOutlined style={{ fontSize: 18 }} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </>
  );
};
