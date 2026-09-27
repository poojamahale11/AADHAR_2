/**
 * Helper utility for determining live volunteer status, active task details,
 * availability schedule formatting, and estimating when busy volunteers will be free.
 */

function formatTime12h(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  return `${hours}:${minutes} ${ampm}`;
}

function formatDateDisplay(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function enrichVolunteerStatus(volunteerDoc, activeTask = null) {
  const volunteer = volunteerDoc.toObject ? volunteerDoc.toObject() : { ...volunteerDoc };

  const availableDay = volunteer.availableDay || 'All Days';
  const availableDate = volunteer.availableDate ? formatDateDisplay(volunteer.availableDate) : null;
  const availableStartTime = volunteer.availableStartTime || '09:00';
  const availableEndTime = volunteer.availableEndTime || '18:00';
  const isAvailable = volunteer.isAvailable !== false;

  let liveStatus = 'available';
  let liveStatusLabel = 'Available Now';
  let statusBadgeClass = 'pill-delivered';
  let activeTaskInfo = null;
  let whenFreeText = '';

  if (!volunteer.isActive) {
    liveStatus = 'inactive';
    liveStatusLabel = 'Inactive / Disabled';
    statusBadgeClass = 'pill-rejected';
    whenFreeText = 'Account deactivated by admin';
  } else if (!volunteer.isApproved) {
    liveStatus = 'pending';
    liveStatusLabel = 'Pending Approval';
    statusBadgeClass = 'pill-pending';
    whenFreeText = 'Awaiting NGO approval';
  } else if (activeTask) {
    liveStatus = 'busy';
    liveStatusLabel = 'Assigned / Busy';
    statusBadgeClass = 'pill-assigned';

    const d = activeTask.donationId;
    const req = activeTask.foodRequestId;
    const taskStatus = activeTask.status || 'assigned';
    const taskStatusMap = {
      assigned: 'Task Assigned',
      accepted: 'Accepted (En Route to Pickup)',
      pickup_reached: 'Reached Pickup Point',
      picked: 'Picked Up (Preparing Delivery)',
      in_transit: 'In Transit to Beneficiary',
      delivered: 'Delivered',
    };

    activeTaskInfo = {
      taskId: activeTask._id,
      taskType: d ? (d.type || 'Donation') : (req ? 'Elderly Food Support' : 'Delivery Task'),
      taskCode: d?.donationCode || (req ? 'Food Req #' + String(req._id || activeTask._id).slice(-4) : 'Task'),
      taskStatus: taskStatus,
      taskStatusLabel: taskStatusMap[taskStatus] || taskStatus.replace(/_/g, ' '),
      pickupAddress: activeTask.pickupLocation?.address || d?.pickupLocation?.address || 'Pickup Point',
      deliveryAddress: activeTask.deliveryLocation?.address || req?.deliveryAddress || 'Delivery Address',
      timeSlot: d?.timeSlot || null,
      donorName: d?.donorId?.name || null,
      beneficiaryName: activeTask.beneficiaryId?.name || req?.householdId?.name || null,
    };

    // Calculate free-time estimate
    if (d?.timeSlot?.endTime) {
      whenFreeText = `Expected free by ${formatTime12h(d.timeSlot.endTime)} (Window: ${d.timeSlot.startTime}–${d.timeSlot.endTime})`;
    } else if (taskStatus === 'in_transit') {
      whenFreeText = 'Expected free in ~20-30 mins (Currently in transit for delivery)';
    } else if (taskStatus === 'picked') {
      whenFreeText = 'Expected free after drop-off delivery';
    } else if (taskStatus === 'pickup_reached' || taskStatus === 'accepted') {
      whenFreeText = 'Busy with pickup & delivery sequence';
    } else {
      whenFreeText = `Busy with assigned task ${activeTaskInfo.taskCode} (Duty until ${formatTime12h(availableEndTime)})`;
    }
  } else if (!isAvailable) {
    liveStatus = 'unavailable';
    liveStatusLabel = 'Unavailable / Off-Duty';
    statusBadgeClass = 'pill-cancelled';
    whenFreeText = `Off-duty · Next available on ${availableDate || availableDay} at ${formatTime12h(availableStartTime)}`;
  } else {
    liveStatus = 'available';
    liveStatusLabel = 'Available Now';
    statusBadgeClass = 'pill-delivered';
    whenFreeText = `Available now · On duty until ${formatTime12h(availableEndTime)}`;
  }

  // Format schedule strings
  let scheduleDateText = availableDay;
  if (availableDate) {
    scheduleDateText = `${availableDate} (${availableDay})`;
  }

  const timeWindowText = `${formatTime12h(availableStartTime)} – ${formatTime12h(availableEndTime)}`;

  return {
    ...volunteer,
    liveStatus,
    liveStatusLabel,
    statusBadgeClass,
    activeTaskInfo,
    whenFreeText,
    availableDay,
    availableDate,
    availableStartTime,
    availableEndTime,
    availableStartTime12h: formatTime12h(availableStartTime),
    availableEndTime12h: formatTime12h(availableEndTime),
    scheduleDateText,
    timeWindowText,
    isAvailable,
  };
}

module.exports = {
  formatTime12h,
  formatDateDisplay,
  enrichVolunteerStatus,
};
