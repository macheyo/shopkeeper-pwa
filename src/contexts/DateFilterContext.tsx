"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import {
  DateRange,
  CustomDateRange,
  getDateRangeFromFilter,
} from "@/components/DateFilter";

// Define the context type
interface DateFilterContextType {
  dateRange: DateRange;
  customDateRange: CustomDateRange | undefined;
  setDateRange: (range: DateRange, customRange?: CustomDateRange) => void;
  dateRangeInfo: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
}

// Create the context with a default value
const DateFilterContext = createContext<DateFilterContextType | undefined>(
  undefined
);

// Custom hook to use the date filter context
export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (context === undefined) {
    throw new Error("useDateFilter must be used within a DateFilterProvider");
  }
  return context;
}

// Provider component
export function DateFilterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize with 'today' as the default date range
  const [dateRange, setDateRangeState] = useState<DateRange>("today");
  const [customDateRange, setCustomDateRange] = useState<
    CustomDateRange | undefined
  >(undefined);

  // Calculate the actual date range info based on the selected range
  const dateRangeInfo = useMemo(() => {
    return getDateRangeFromFilter(dateRange, customDateRange);
  }, [dateRange, customDateRange]);

  // Load saved date range from localStorage on initial render
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedDateRange = localStorage.getItem("shopkeeper_date_range");
      const savedCustomRange = localStorage.getItem(
        "shopkeeper_custom_date_range"
      );

      if (savedDateRange) {
        setDateRangeState(savedDateRange as DateRange);
      }

      if (savedCustomRange) {
        const parsedCustomRange = JSON.parse(savedCustomRange);
        // Convert string dates back to Date objects
        setCustomDateRange({
          startDate: new Date(parsedCustomRange.startDate),
          endDate: new Date(parsedCustomRange.endDate),
        });
      }
    } catch (error) {
      console.error("Error loading date range from localStorage:", error);
    }
  }, []);

  // Function to update the date range and save to localStorage
  const setDateRange = (range: DateRange, customRange?: CustomDateRange) => {
    // Update state with new values
    setDateRangeState(range);
    setCustomDateRange(customRange);

    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("shopkeeper_date_range", range);
      if (customRange) {
        localStorage.setItem(
          "shopkeeper_custom_date_range",
          JSON.stringify(customRange)
        );
      } else if (range !== "custom") {
        localStorage.removeItem("shopkeeper_custom_date_range");
      }
    }

    // Force a small timeout to ensure state updates are processed
    // This helps ensure components depending on dateRangeInfo re-render
    setTimeout(() => {
      // This empty state update will trigger a re-render in components
      // that depend on the context
      setDateRangeState((prev) => prev);
    }, 0);
  };

  // Create the context value
  const contextValue: DateFilterContextType = {
    dateRange,
    customDateRange,
    setDateRange,
    dateRangeInfo,
  };

  return (
    <DateFilterContext.Provider value={contextValue}>
      {children}
    </DateFilterContext.Provider>
  );
}
