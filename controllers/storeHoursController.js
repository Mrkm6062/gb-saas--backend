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
          const openMin = timeToMinutes(slot.open);
          const closeMin = timeToMinutes(slot.close);
          if (closeMin < openMin) return currentMinutes >= openMin || currentMinutes <= closeMin;
          return currentMinutes >= openMin && currentMinutes <= closeMin;
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
          const openMin = timeToMinutes(slot.open);
          const closeMin = timeToMinutes(slot.close);
          if (closeMin < openMin) return currentMinutes >= openMin || currentMinutes <= closeMin;
          return currentMinutes >= openMin && currentMinutes <= closeMin;
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
        const openMin = timeToMinutes(slot.open);
        const closeMin = timeToMinutes(slot.close);
        if (closeMin < openMin) return currentMinutes >= openMin || currentMinutes <= closeMin;
        return currentMinutes >= openMin && currentMinutes <= closeMin;
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
    if (req.user.role !== 'superadmin') {
      const possibleOwnerIds = [req.user.userId, req.user._id, String(req.user._id)].filter(Boolean);
      storeQuery.ownerId = { $in: possibleOwnerIds };
    }
    const store = await Store.findOne(storeQuery);
    if (!store) {
      return res.status(403).json({ message: "Not authorized to update store hours for this store." });
    }

    const updated = await StoreHours.findOneAndUpdate(
      { storeId },
      { 
        $set: {
          storeId,
          mode: mode || "24x7",
          timezone: timezone || "Asia/Kolkata",
          weeklySchedule: Array.isArray(weeklySchedule) ? weeklySchedule : [],
          holidays: Array.isArray(holidays) ? holidays : [],
          specialHours: Array.isArray(specialHours) ? specialHours : [],
          temporaryClosure: temporaryClosure || { enabled: false, reason: "" },
          displayStoreStatus: displayStoreStatus !== undefined ? displayStoreStatus : true
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Calculate next opening day and time
export const getNextOpeningTime = (storeHours, localDate, timeStr, dateStr, tz) => {
  const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const currentMinutes = timeToMinutes(timeStr);

  const tzFormattedTime = (hhmm) => {
    try {
      const [h, m] = hhmm.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 || 12;
      return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch(e) {
      return hhmm;
    }
  };

  const buildTargetIso = (dateString, openTimeString) => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const [hours, minutes] = openTimeString.split(':').map(Number);
      const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
      const invdate = new Date(guess.toLocaleString('en-US', { timeZone: tz }));
      const diff = guess.getTime() - invdate.getTime();
      const targetDate = new Date(guess.getTime() + diff);

      return {
        targetIso: targetDate.toISOString(),
        targetTimestamp: targetDate.getTime()
      };
    } catch(err) {
      return {
        targetIso: `${dateString}T${openTimeString}:00`,
        targetTimestamp: null
      };
    }
  };

  // 1. Check if store opens LATER TODAY (day 0)
  let todayBlocked = false;

  // A. Check Temporary Closure
  if (storeHours.temporaryClosure?.enabled) {
    const start = storeHours.temporaryClosure.startDate;
    const end = storeHours.temporaryClosure.endDate;
    const now = new Date();
    if ((!start || now >= start) && (!end || now <= end)) {
      todayBlocked = true;
    }
  }

  // B. Check Holiday today
  if (!todayBlocked && storeHours.holidays && storeHours.holidays.length > 0) {
    const holidayMatch = storeHours.holidays.find(h => {
      if (!h.date) return false;
      const hDateStr = new Date(h.date).toISOString().split('T')[0];
      return hDateStr === dateStr;
    });
    if (holidayMatch) {
      if (holidayMatch.closed) {
        todayBlocked = true;
      } else if (holidayMatch.slots && holidayMatch.slots.length > 0) {
        const nextSlot = holidayMatch.slots.find(slot => timeToMinutes(slot.open) > currentMinutes);
        if (nextSlot) {
          const { targetIso, targetTimestamp } = buildTargetIso(dateStr, nextSlot.open);
          return {
            day: "Today",
            date: dateStr,
            time: tzFormattedTime(nextSlot.open),
            openTime: nextSlot.open,
            targetIso,
            targetTimestamp
          };
        } else {
          todayBlocked = true;
        }
      }
    }
  }

  // C. Check Special Hours today
  if (!todayBlocked && storeHours.specialHours && storeHours.specialHours.length > 0) {
    const now = new Date();
    const specialMatch = storeHours.specialHours.find(s => {
      return s.startDate && s.endDate && now >= s.startDate && now <= s.endDate;
    });
    if (specialMatch) {
      if (specialMatch.closed) {
        todayBlocked = true;
      } else if (specialMatch.slots && specialMatch.slots.length > 0) {
        const nextSlot = specialMatch.slots.find(slot => timeToMinutes(slot.open) > currentMinutes);
        if (nextSlot) {
          const { targetIso, targetTimestamp } = buildTargetIso(dateStr, nextSlot.open);
          return {
            day: "Today",
            date: dateStr,
            time: tzFormattedTime(nextSlot.open),
            openTime: nextSlot.open,
            targetIso,
            targetTimestamp
          };
        } else {
          todayBlocked = true;
        }
      }
    }
  }

  // D. Check Custom Weekly Schedule today
  if (!todayBlocked && storeHours.mode === 'custom') {
    const todayName = daysOfWeek[localDate.getDay()];
    const todaySched = storeHours.weeklySchedule?.find(s => s.day === todayName);
    if (todaySched && todaySched.enabled && todaySched.slots && todaySched.slots.length > 0) {
      const nextSlot = todaySched.slots.find(slot => timeToMinutes(slot.open) > currentMinutes);
      if (nextSlot) {
        const { targetIso, targetTimestamp } = buildTargetIso(dateStr, nextSlot.open);
        return {
          day: "Today",
          date: dateStr,
          time: tzFormattedTime(nextSlot.open),
          openTime: nextSlot.open,
          targetIso,
          targetTimestamp
        };
      }
    }
  }

  // 2. Check Upcoming Days (i = 1 to 7)
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(localDate);
    checkDate.setDate(checkDate.getDate() + i);

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(checkDate);
      const partVal = (type) => parts.find(p => p.type === type).value;
      const year = partVal('year');
      const month = partVal('month');
      const day = partVal('day');
      
      const checkDateStr = `${year}-${month}-${day}`;
      const tempDate = new Date(`${year}-${month}-${day}T00:00:00`);
      const checkDayName = daysOfWeek[tempDate.getDay()];

      // A. Check Temporary Closure
      if (storeHours.temporaryClosure?.enabled) {
        const start = storeHours.temporaryClosure.startDate;
        const end = storeHours.temporaryClosure.endDate;
        if ((!start || checkDate >= start) && (!end || checkDate <= end)) {
          continue; // Closed this day
        }
      }

      // B. Check Holiday
      if (storeHours.holidays && storeHours.holidays.length > 0) {
        const holidayMatch = storeHours.holidays.find(h => {
          if (!h.date) return false;
          const hDateStr = new Date(h.date).toISOString().split('T')[0];
          return hDateStr === checkDateStr;
        });
        if (holidayMatch) {
          if (holidayMatch.closed) continue;
          if (holidayMatch.slots && holidayMatch.slots.length > 0) {
            const openTime = holidayMatch.slots[0].open;
            const { targetIso, targetTimestamp } = buildTargetIso(checkDateStr, openTime);
            return {
              day: i === 1 ? "Tomorrow" : checkDayName.charAt(0).toUpperCase() + checkDayName.slice(1),
              date: `${day}/${month}/${year}`,
              time: tzFormattedTime(openTime),
              openTime,
              targetIso,
              targetTimestamp
            };
          }
        }
      }

      // C. Weekly Schedule
      if (storeHours.mode === '24x7') {
        const { targetIso, targetTimestamp } = buildTargetIso(checkDateStr, "00:00");
        return {
          day: i === 1 ? "Tomorrow" : checkDayName.charAt(0).toUpperCase() + checkDayName.slice(1),
          date: `${day}/${month}/${year}`,
          time: "12:00 AM",
          openTime: "00:00",
          targetIso,
          targetTimestamp
        };
      }

      if (storeHours.mode === 'custom') {
        const daySched = storeHours.weeklySchedule?.find(s => s.day === checkDayName);
        if (daySched && daySched.enabled && daySched.slots && daySched.slots.length > 0) {
          const openTime = daySched.slots[0].open;
          const { targetIso, targetTimestamp } = buildTargetIso(checkDateStr, openTime);
          return {
            day: i === 1 ? "Tomorrow" : checkDayName.charAt(0).toUpperCase() + checkDayName.slice(1),
            date: `${day}/${month}/${year}`,
            time: tzFormattedTime(openTime),
            openTime,
            targetIso,
            targetTimestamp
          };
        }
      }
    } catch(err) {
      console.error(err);
    }
  }

  return null;
};

// GET PUBLIC STORE STATUS (IsOpen Check)
export const getPublicStoreStatus = async (req, res) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.storeId || (req.store && req.store._id);
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const status = await checkIsStoreOpen(storeId);
    if (!status.isOpen) {
      // Fetch details to find when it will open
      const storeHours = await StoreHours.findOne({ storeId });
      if (storeHours) {
        const tz = storeHours.timezone || "Asia/Kolkata";
        const { date: localDate, timeStr, dateStr } = getStoreCurrentTime(tz);
        const nextOpen = getNextOpeningTime(storeHours, localDate, timeStr, dateStr, tz);
        status.nextOpen = nextOpen;
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
