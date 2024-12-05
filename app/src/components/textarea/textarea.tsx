// In Textarea.tsx (or wherever Textarea is defined)

import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const Textarea: React.FC<TextareaProps> = ({ value, onChange, className, ...props }) => (
  <textarea
    value={value}
    onChange={onChange}
    className={className} // Ensure className is passed through
    {...props}
  />
);

export default Textarea;
