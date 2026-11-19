import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'

function message(error, fallback) {
  return error?.response?.data?.message ?? fallback
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export function ProjectCollaborationPanel({
  groupId,
  role,
  advisorAssigned = true,
  correctionAllowed = false,
}) {
  const queryClient = useQueryClient()
  const [messageText, setMessageText] = useState('')
  const [file, setFile] = useState(null)
  const [documentType, setDocumentType] = useState('advisor_document')
  const [downloadError, setDownloadError] = useState('')
  const messagesQuery = useQuery({
    queryKey: ['project-messages', groupId],
    queryFn: async () => (await api.get(`/projects/groups/${groupId}/messages`)).data.data,
    refetchInterval: 5000,
  })
  const documentsQuery = useQuery({
    queryKey: ['project-documents', groupId],
    queryFn: async () => (await api.get(`/projects/groups/${groupId}/documents`)).data.data,
    refetchInterval: 15000,
  })
  const sendMutation = useMutation({
    mutationFn: async () => (await api.post(`/projects/groups/${groupId}/messages`, {
      message: messageText,
    })).data.data,
    onSuccess: () => {
      setMessageText('')
      void queryClient.invalidateQueries({ queryKey: ['project-messages', groupId] })
    },
  })
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const body = new FormData()
      body.append('documentType', documentType)
      body.append('document', file)
      return (await api.post(`/projects/groups/${groupId}/documents`, body)).data.data
    },
    onSuccess: () => {
      setFile(null)
      void queryClient.invalidateQueries({ queryKey: ['project-documents', groupId] })
    },
  })

  async function downloadDocument(document) {
    setDownloadError('')
    try {
      const response = await api.get(`/projects/documents/${document.id}/download`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.fileName
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setDownloadError(message(error, 'Could not download the project document'))
    }
  }

  function sendMessage(event) {
    event.preventDefault()
    sendMutation.mutate()
  }

  function uploadDocument(event) {
    event.preventDefault()
    uploadMutation.mutate()
  }

  const canSend = role === 'academic_advisor' || advisorAssigned

  return (
    <section className="academic-card">
      <h3 className="section-title">Advisor messages</h3>
      <p className="page-subtitle">Messages refresh automatically every five seconds.</p>
      {messagesQuery.error && <div className="table-error" role="alert">
        {message(messagesQuery.error, 'Could not load messages')}
      </div>}
      {sendMutation.error && <div className="table-error" role="alert">
        {message(sendMutation.error, 'Could not send your message')}
      </div>}
      <div className="project-message-list" aria-live="polite">
        {(messagesQuery.data ?? []).map((item) => (
          <article className="project-message" key={item.id}>
            <div className="action-row">
              <strong>{item.senderName}</strong>
              <span className="muted-copy">{formatDate(item.sentAt)}</span>
            </div>
            <p>{item.message}</p>
          </article>
        ))}
        {messagesQuery.data?.length === 0 && (
          <p className="muted-copy">No messages yet.</p>
        )}
      </div>
      {canSend ? (
        <form className="import-form" onSubmit={sendMessage}>
          <label className="form-field">
            <span className="form-label">Message</span>
            <textarea className="form-input" required minLength={1} maxLength={5000} rows={3}
              value={messageText} onChange={(event) => setMessageText(event.target.value)} />
          </label>
          <button className="btn-primary" disabled={sendMutation.isPending || !messageText.trim()}>
            {sendMutation.isPending ? 'Sending…' : 'Send message'}
          </button>
        </form>
      ) : (
        <p className="muted-copy">Messaging becomes available after an advisor is assigned.</p>
      )}

      <h3 className="section-title">Project documents</h3>
      {documentsQuery.error && <div className="table-error" role="alert">
        {message(documentsQuery.error, 'Could not load project documents')}
      </div>}
      {uploadMutation.error && <div className="table-error" role="alert">
        {message(uploadMutation.error, 'Could not upload the document')}
      </div>}
      {downloadError && <div className="table-error" role="alert">{downloadError}</div>}
      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Document</th><th>Type</th><th>Uploaded by</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            {(documentsQuery.data ?? []).map((document) => (
              <tr key={document.id}>
                <td>{document.fileName}</td>
                <td>{document.documentType === 'defense_correction' ? 'Defense correction' : 'For advisor'}</td>
                <td>{document.uploaderName}</td>
                <td>{formatDate(document.uploadedAt)}</td>
                <td><button className="btn-secondary" onClick={() => downloadDocument(document)}>Download</button></td>
              </tr>
            ))}
            {documentsQuery.data?.length === 0 && (
              <tr><td className="table-empty" colSpan={5}>No documents have been uploaded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {role === 'student' && (
        <>
          <form className="import-form" onSubmit={uploadDocument}>
            <label className="form-field">
              <span className="form-label">Document type</span>
              <select className="form-input" value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}>
                <option value="advisor_document">Document for advisor</option>
                {correctionAllowed && <option value="defense_correction">Defense correction</option>}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">PDF or DOCX document (max 20 MB)</span>
              <input className="form-input file-input" type="file" accept=".pdf,.docx" required
                onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <button className="btn-primary" disabled={!file || uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Uploading…' : 'Upload document'}
            </button>
          </form>
          {!correctionAllowed && (
            <p className="muted-copy">Defense corrections can be uploaded after an examiner requests revisions.</p>
          )}
        </>
      )}
    </section>
  )
}
