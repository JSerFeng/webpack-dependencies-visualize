import React from "react";
import { Button } from "@arco-design/web-react";
import { IconPlus, IconClose } from "@arco-design/web-react/icon";
import classNames from 'classnames';

interface FileTabBarProps {
  className?: string,
  files: string[];
  activeFile: string;
  onSelectFile: (filename: string) => void;
  onAddFile: () => void;
  onDeleteFile: (filename: string) => void;
  fileTabRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

const FileTabBar: React.FC<FileTabBarProps> = ({
  className,
  files,
  activeFile,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  fileTabRefs,
}) => {
  return (
    <div className={classNames("file-tab-bar", className)}>
      {files.map((filename) => (
        <div
          key={filename}
          ref={(el) => {
            fileTabRefs.current[filename] = el;
          }}
          className={`file-tab ${activeFile === filename ? "active" : ""}`}
          onClick={() => onSelectFile(filename)}
        >
          <span className="file-tab-name">{filename}</span>
          {filename !== "index.js" && (
            <IconClose
              className="file-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(filename);
              }}
            />
          )}
        </div>
      ))}
      <Button
        type="text"
        icon={<IconPlus />}
        size="small"
        onClick={onAddFile}
        className="add-file-btn"
      />
    </div>
  );
};

export default FileTabBar;
