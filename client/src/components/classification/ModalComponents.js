// src/components/classification/ModalComponents.js
import React from 'react';

export const ModalWrapper = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onSubmit, 
  submitLabel = 'Submit', 
  submitDisabled = false,
  closeLabel = 'Cancel'
}) => {
  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent default form submission
    e.stopPropagation(); // Stop event from bubbling to parent form
    onSubmit();
  };

  const handleBackdropClick = (e) => {
    // Close modal only if clicking directly on backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        onClick={handleBackdropClick}
        style={{ zIndex: 1050 }}
      ></div>
      <div 
        className="modal fade show" 
        style={{ display: 'block', zIndex: 1060 }} 
        tabIndex="-1"
        onKeyDown={handleKeyDown}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {children}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onClose}
                >
                  {closeLabel}
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitDisabled}
                >
                  {submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

// Specific Modal Components
export const NewGroupModal = ({ 
  isOpen, 
  onClose, 
  newGroupName, 
  onGroupNameChange, 
  onSubmit 
}) => {
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Group"
      onSubmit={onSubmit}
      submitLabel="Add Group"
      submitDisabled={!newGroupName.trim()}
    >
      <div className="mb-3">
        <label className="form-label">Group Name</label>
        <input
          type="text"
          className="form-control"
          value={newGroupName}
          onChange={onGroupNameChange}
          autoFocus
          maxLength={100}
          required
        />
      </div>
    </ModalWrapper>
  );
};

export const RenameGroupModal = ({
  isOpen,
  onClose,
  groupName,
  onGroupNameChange,
  onSubmit
}) => {
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Group"
      onSubmit={onSubmit}
      submitLabel="Rename Group"
      submitDisabled={!groupName.trim()}
    >
      <div className="mb-3">
        <label className="form-label">New Group Name</label>
        <input
          type="text"
          className="form-control"
          value={groupName}
          onChange={onGroupNameChange}
          autoFocus
          maxLength={100}
          required
        />
      </div>
    </ModalWrapper>
  );
};

export const DeleteGroupConfirmationModal = ({
  isOpen,
  onClose,
  groupName,
  hasParameters,
  groupOptions,
  newGroupForQuestions,
  onNewGroupChange,
  onSubmit
}) => {
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Group"
      onSubmit={onSubmit}
      submitLabel="Delete Group"
      submitDisabled={hasParameters && !newGroupForQuestions}
    >
      {hasParameters ? (
        <>
          <div className="alert alert-warning">
            <strong>Warning:</strong> This group contains questions that need to be moved to another group.
          </div>
          <div className="mb-3">
            <label className="form-label">Move questions to:</label>
            <select
              className="form-select"
              value={newGroupForQuestions}
              onChange={onNewGroupChange}
              required
            >
              <option value="">Select a group</option>
              {groupOptions.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <p>Are you sure you want to delete the group "{groupName}"?</p>
      )}
    </ModalWrapper>
  );
};