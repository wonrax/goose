import { useState } from 'react';
import { Button } from '../../../ui/button';
import Modal from '../../../Modal';
import { ExtensionFormData } from '../utils';
import EnvVarsSection from './EnvVarsSection';
import ExtensionConfigFields from './ExtensionConfigFields';
import { PlusIcon, Edit, Trash2, AlertTriangle } from 'lucide-react';
import ExtensionInfoFields from './ExtensionInfoFields';
import ExtensionTimeoutField from './ExtensionTimeoutField';
import { upsertConfig } from '../../../../api/sdk.gen';

interface ExtensionModalProps {
  title: string;
  initialData: ExtensionFormData;
  onClose: () => void;
  onSubmit: (formData: ExtensionFormData) => void;
  onDelete?: (name: string) => void;
  submitLabel: string;
  modalType: 'add' | 'edit';
}

export default function ExtensionModal({
  title,
  initialData,
  onClose,
  onSubmit,
  onDelete,
  submitLabel,
  modalType,
}: ExtensionModalProps) {
  const [formData, setFormData] = useState<ExtensionFormData>(initialData);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleAddEnvVar = (key: string, value: string) => {
    setFormData({
      ...formData,
      envVars: [...formData.envVars, { key, value, isEdited: true }],
    });
  };

  const handleRemoveEnvVar = (index: number) => {
    const newEnvVars = [...formData.envVars];
    newEnvVars.splice(index, 1);
    setFormData({
      ...formData,
      envVars: newEnvVars,
    });
  };

  const handleEnvVarChange = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...formData.envVars];
    newEnvVars[index][field] = value;

    // Mark as edited if it's a value change
    if (field === 'value') {
      newEnvVars[index].isEdited = true;
    }

    setFormData({
      ...formData,
      envVars: newEnvVars,
    });
  };

  // Function to store a secret value
  const storeSecret = async (key: string, value: string) => {
    try {
      await upsertConfig({
        body: {
          is_secret: true,
          key: key,
          value: value,
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to store secret:', error);
      return false;
    }
  };

  // Function to determine which icon to display with proper styling
  const getModalIcon = () => {
    if (showDeleteConfirmation) {
      return <AlertTriangle className="text-red-500" size={24} />;
    }
    return modalType === 'add' ? (
      <PlusIcon className="text-iconStandard" size={24} />
    ) : (
      <Edit className="text-iconStandard" size={24} />
    );
  };

  const isNameValid = () => {
    return formData.name.trim() !== '';
  };

  const isConfigValid = () => {
    return (
      (formData.type === 'stdio' && !!formData.cmd && formData.cmd.trim() !== '') ||
      (formData.type === 'sse' && !!formData.endpoint && formData.endpoint.trim() !== '')
    );
  };

  const isEnvVarsValid = () => {
    return formData.envVars.every(
      ({ key, value }) => (key === '' && value === '') || (key !== '' && value !== '')
    );
  };

  const isTimeoutValid = () => {
    // Check if timeout is not undefined, null, or empty string
    if (formData.timeout === undefined || formData.timeout === null) {
      return false;
    }

    // Convert to number if it's a string
    const timeoutValue =
      typeof formData.timeout === 'string' ? Number(formData.timeout) : formData.timeout;

    // Check if it's a valid number (not NaN) and is a positive number
    return !isNaN(timeoutValue) && timeoutValue > 0;
  };

  // Form validation
  const isFormValid = () => {
    return isNameValid() && isConfigValid() && isEnvVarsValid() && isTimeoutValid();
  };

  // Handle submit with validation and secret storage
  const handleSubmit = async () => {
    setSubmitAttempted(true);

    if (isFormValid()) {
      // Only store env vars that have been edited (which includes new)
      const secretPromises = formData.envVars
        .filter((envVar) => envVar.isEdited)
        .map(({ key, value }) => storeSecret(key, value));

      try {
        // Wait for all secrets to be stored
        const results = await Promise.all(secretPromises);

        if (results.every((success) => success)) {
          // Convert timeout to number if needed
          const dataToSubmit = {
            ...formData,
            timeout:
              typeof formData.timeout === 'string' ? Number(formData.timeout) : formData.timeout,
          };
          onSubmit(dataToSubmit);
          onClose();
        } else {
          console.error('Failed to store one or more secrets');
        }
      } catch (error) {
        console.error('Error during submission:', error);
      }
    } else {
      console.log('Form validation failed');
    }
  };

  // Create footer buttons based on current state
  const footerContent = showDeleteConfirmation ? (
    // Delete confirmation footer
    <>
      <div className="w-full px-6 py-4 bg-red-900/20 border-t border-red-500/30">
        <p className="text-red-400 text-sm mb-2">
          Are you sure you want to remove "{formData.name}"? This action cannot be undone.
        </p>
      </div>
      <Button
        onClick={() => {
          if (onDelete) {
            onDelete(formData.name);
            onClose(); // Add this line to close the modal after deletion
          }
        }}
        className="w-full h-[60px] rounded-none border-b border-borderSubtle bg-transparent hover:bg-red-900/20 text-red-500 font-medium text-md"
      >
        <Trash2 className="h-4 w-4 mr-2" /> Confirm removal
      </Button>
      <Button
        onClick={() => setShowDeleteConfirmation(false)}
        variant="ghost"
        className="w-full h-[60px] rounded-none hover:bg-bgSubtle text-textSubtle hover:text-textStandard text-md font-regular"
      >
        Cancel
      </Button>
    </>
  ) : (
    // Normal footer
    <>
      {modalType === 'edit' && onDelete && (
        <Button
          onClick={() => setShowDeleteConfirmation(true)}
          className="w-full h-[60px] rounded-none border-b border-borderSubtle bg-transparent hover:bg-bgSubtle text-red-500 font-medium text-md [&>svg]:!size-4"
        >
          <Trash2 className="h-4 w-4 mr-2" /> Remove extension
        </Button>
      )}
      <Button
        onClick={handleSubmit}
        className="w-full h-[60px] rounded-none border-b border-borderSubtle bg-transparent hover:bg-bgSubtle text-textProminent font-medium text-md"
      >
        {submitLabel}
      </Button>
      <Button
        onClick={onClose}
        variant="ghost"
        className="w-full h-[60px] rounded-none hover:bg-bgSubtle text-textSubtle hover:text-textStandard text-md font-regular"
      >
        Cancel
      </Button>
    </>
  );

  // Update title based on current state
  const modalTitle = showDeleteConfirmation ? `Delete Extension "${formData.name}"` : title;

  return (
    <Modal footer={footerContent} onClose={onClose}>
      {/* Title and Icon */}
      <div className="flex flex-col mb-6">
        <div>{getModalIcon()}</div>
        <div className="mt-2">
          <h2 className="text-2xl font-regular text-textStandard">{modalTitle}</h2>
        </div>
      </div>

      {showDeleteConfirmation ? (
        <div className="mb-6">
          <p className="text-textStandard">
            This will permanently remove this extension and all of its settings.
          </p>
        </div>
      ) : (
        <>
          {/* Form Fields */}
          {/* Name and Type */}
          <ExtensionInfoFields
            name={formData.name}
            type={formData.type}
            description={formData.description}
            onChange={(key, value) => setFormData({ ...formData, [key]: value })}
            submitAttempted={submitAttempted}
          />

          {/* Divider */}
          <hr className="border-t border-borderSubtle mb-4" />

          {/* Command */}
          <div className="mb-6">
            <ExtensionConfigFields
              type={formData.type}
              full_cmd={formData.cmd || ''}
              endpoint={formData.endpoint || ''}
              onChange={(key, value) => setFormData({ ...formData, [key]: value })}
              submitAttempted={submitAttempted}
              isValid={isConfigValid()}
            />
            <div className="mb-4" />
            <ExtensionTimeoutField
              timeout={formData.timeout || 300}
              onChange={(key, value) => setFormData({ ...formData, [key]: value })}
              submitAttempted={submitAttempted}
            />
          </div>

          {/* Divider */}
          <hr className="border-t border-borderSubtle mb-4" />

          {/* Environment Variables */}
          <div className="mb-6">
            <EnvVarsSection
              envVars={formData.envVars}
              onAdd={handleAddEnvVar}
              onRemove={handleRemoveEnvVar}
              onChange={handleEnvVarChange}
              submitAttempted={submitAttempted}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
