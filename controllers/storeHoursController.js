import StoreHours from "../models/StoreHours.js";
import Store from "../models/Store.js";

// Helper: Convert time string to minutes
const timeToMinutes = (timeString) => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper: Get local time variables for a timezone
export const getStoreCurrentTime = (timezone = 'Asia/Kolkata') => {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const partVal = (type) => parts.find(p => p.type === type).value;
    
    const year = partVal('year');
    const month = partVal('month');
    const day = partVal('day');
    const hour = partVal('hour');
    const minute = partVal('minute');
    const second = partVal('second');
    
    // Format: YYYY-MM-DDTHH:mm:ss
    const localDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = daysOfWeek[localDate.getDay()];
    
    return {
      date: localDate,
      timeStr: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      dayName,
      dateStr: `${year}-${month}-${day}`
    };
  } catch (err) {
    console.error("Error formatting timezone", err);
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return {
      date: now,
      timeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      dayName: daysOfWeek[now.getDay()],
      dateStr: now.toISOString().split('T')[0]
    };
  }
};

// Main Helper: Check if store is open
export const checkIsStoreOpen = async (storeId) => {
  const storeHours = await StoreHours.findOne({ storeId });
  if (!storeHours) return { isOpen: true, reason: "" };

  const tz = storeHours.timezone || "Asia/Kolkata";
  const { date: localDate, timeStr, dayName, dateStr } = getStoreCurrentTime(tz);

  // 1. Check Temporary Closure
  if (storeHours.temporaryClosure?.enabled) {
    const start = storeHours.temporaryClosure.startDate;
    const end = storeHours.temporaryClosure.endDate;
    const now = new Date();
    if ((!start || now >= start) && (!end || now <= end)) {
      return { 
        isOpen: false, 
        reason: storeHours.temporaryClosure.reason || "Store is temporarily closed" 
      };
    }
  }

  // 2. Check Holidays
  if (storeHours.holidays && storeHours.holidays.length > 0) {
    const holidayMatch = storeHours.holidays.find(h => {
      if (!h.date) return false;
      const hDateStr = new Date(h.date).toISOString().split('T')[0];
      return hDateStr === dateStr;
    });

    if (holidayMatch) {
      if (holidayMatch.closed) {
        return { isOpen: false, reason: `Closed for Holiday: ${holidayMatch.name || "Holiday"}` };
      }
      if (holidayMatch.slots && holidayMatch.slots.length > 0) {
        const currentMinutes = timeToMinutes(timeStr);
        const inSlot = holidayMatch.slots.some(slot => {
          return currentMinutes >= timeToMinutes(slot.open) && currentMinutes <= timeToMinutes(slot.close);
        });
        if (!inSlot) {
          return { isOpen: false, reason: `Closed (Holiday Hours: ${holidayMatch.name})` };
        }
      }
    }
  }

  // 3. Check Special Hours
  if (storeHours.specialHours && storeHours.specialHours.length > 0) {
    const now = new Date();
    const specialMatch = storeHours.specialHours.find(s => {
      return s.startDate && s.endDate && now >= s.startDate && now <= s.endDate;
    });

    if (specialMatch) {
      if (specialMatch.closed) {
        return { isOpen: false, reason: `Closed: ${specialMatch.title || "Special Schedule"}` };
      }
      if (specialMatch.slots && specialMatch.slots.length > 0) {
        const currentMinutes = timeToMinutes(timeStr);
        const inSlot = specialMatch.slots.some(slot => {
          return currentMinutes >= timeToMinutes(slot.open) && currentMinutes <= timeToMinutes(slot.close);
        });
        if (!inSlot) {
          return { isOpen: false, reason: `Closed (Special Hours: ${specialMatch.title})` };
        }
      }
    }
  }

  // 4. Mode 24x7 Check
  if (storeHours.mode === "24x7") {
    return { isOpen: true, reason: "" };
  }

  // 5. Custom Schedule Check
  if (storeHours.mode === "custom") {
    const daySchedule = storeHours.weeklySchedule.find(s => s.day === dayName);
    if (!daySchedule || !daySchedule.enabled) {
      return { isOpen: false, reason: `Closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}` };
    }

    if (daySchedule.slots && daySchedule.slots.length > 0) {
      const currentMinutes = timeToMinutes(timeStr);
      const inSlot = daySchedule.slots.some(slot => {
        return currentMinutes >= timeToMinutes(slot.open) && currentMinutes <= timeToMinutes(slot.close);
      });
      if (!inSlot) {
        return { isOpen: false, reason: "Store is currently closed" };
      }
      return { isOpen: true, reason: "" };
    }
    
    return { isOpen: false, reason: "Store is currently closed (No time slots configured)" };
  }

  return { isOpen: true, reason: "" };
};

// GET STORE HOURS
export const getStoreHours = async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.storeId || (req.store && req.store._id);
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    let storeHours = await StoreHours.findOne({ storeId });
    if (!storeHours) {
      // Return default 24x7 weekly schedule structure
      const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      storeHours = {
        storeId,
        mode: "24x7",
        timezone: "Asia/Kolkata",
        weeklySchedule: defaultDays.map(day => ({
          day,
          enabled: true,
          slots: [{ open: "00:00", close: "23:59" }]
        })),
        holidays: [],
        specialHours: [],
        temporaryClosure: { enabled: false, reason: "", startDate: null, endDate: null },
        displayStoreStatus: true
      };
    }

    res.json(storeHours);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STORE HOURS (Auth Required)
export const updateStoreHours = async (req, res) => {
  try {
    const { storeId, mode, timezone, weeklySchedule, holidays, specialHours, temporaryClosure, displayStoreStatus } = req.body;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify user authorization for this store
    const storeQuery = { _id: storeId };
    if (req.user.role !== 'superadmin') storeQuery.ownerId = req.user.userId;
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to update store hours for this store." });
    }

    const updated = await StoreHours.findOneAndUpdate(
      { storeId },
      { mode, timezone, weeklySchedule, holidays, specialHours, temporaryClosure, displayStoreStatus },
      { new: true, upsert: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET PUBLIC STORE STATUS (IsOpen Check)
export const getPublicStoreStatus = async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.storeId || (req.store && req.store._id);
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const status = await checkIsStoreOpen(storeId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
