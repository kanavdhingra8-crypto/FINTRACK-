import { Bell, Check, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { formatInr } from '../utils/format';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [threshold, setThreshold] = useState('10000');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiRequest('/notifications');
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  async function markAsRead(notificationId) {
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
      setNotifications((current) => current.map((item) => (
        item.id === notificationId ? { ...item, isRead: true } : item
      )));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function saveThreshold(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      await apiRequest('/notifications/settings/threshold', {
        method: 'PUT',
        body: { threshold: Number(threshold) },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="notification-wrap">
      <button
        className="icon-button notification-button"
        type="button"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell size={19} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <section className="notification-panel" aria-label="Notifications">
          <div className="panel-heading">
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount} unread</p>
            </div>
            <button className="icon-button small-icon" type="button" onClick={() => setIsOpen(false)} aria-label="Close notifications">
              <X size={17} />
            </button>
          </div>

          {error && <p className="inline-error">{error}</p>}

          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="empty-message">No expense alerts yet.</p>
            ) : notifications.map((notification) => (
              <article className={`notification-item ${notification.isRead ? '' : 'unread'}`} key={notification.id}>
                <div>
                  <strong>{notification.category}</strong>
                  <p>
                    Expense of {formatInr(notification.amount)} crossed your alert threshold.
                  </p>
                  <time>{notification.date}</time>
                </div>
                {!notification.isRead && (
                  <button
                    className="icon-button small-icon"
                    type="button"
                    onClick={() => markAsRead(notification.id)}
                    aria-label={`Mark ${notification.category} alert as read`}
                  >
                    <Check size={17} />
                  </button>
                )}
              </article>
            ))}
          </div>

          <form className="threshold-form" onSubmit={saveThreshold}>
            <label htmlFor="expense-threshold">Expense alert threshold (INR)</label>
            <div className="threshold-controls">
              <input
                id="expense-threshold"
                type="number"
                min="0.01"
                step="0.01"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                required
              />
              <button className="button button-small" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
