"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";

export interface PlaceResult {
  place_id: string;
  description: string;
  lat: number;
  lng: number;
}

interface PlaceAutocompleteInputProps {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  value: string;
  placeholder?: string;
  required?: boolean;
  onPlaceSelected: (place: PlaceResult) => void;
  onTextChange?: (val: string) => void;
}

interface Prediction {
  place_id: string;
  description: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function PlaceAutocompleteInput({
  id,
  label,
  icon,
  value,
  placeholder,
  required,
  onPlaceSelected,
  onTextChange,
}: PlaceAutocompleteInputProps) {
  const [inputText, setInputText] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebounce(inputText, 320);

  // Sync external value changes (e.g. preset applied)
  useEffect(() => {
    setInputText(value);
  }, [value]);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (debouncedInput.trim().length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/maps/autocomplete?input=${encodeURIComponent(debouncedInput)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const preds = data.predictions ?? [];
        setPredictions(preds);
        setOpen(preds.length > 0);
      })
      .catch(() => {
        if (!cancelled) setPredictions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback(
    async (pred: Prediction) => {
      setOpen(false);
      setInputText(pred.description);
      onTextChange?.(pred.description);
      setResolving(true);
      try {
        const res = await fetch(
          `/api/maps/place-details?place_id=${encodeURIComponent(pred.place_id)}`
        );
        const data = await res.json();
        if (data.lat != null) {
          onPlaceSelected({
            place_id: pred.place_id,
            description: pred.description,
            lat: data.lat,
            lng: data.lng,
          });
        }
      } catch {
        // fallback: pass without coords
        onPlaceSelected({ place_id: pred.place_id, description: pred.description, lat: 0, lng: 0 });
      } finally {
        setResolving(false);
      }
    },
    [onPlaceSelected, onTextChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTextChange?.(e.target.value);
  };

  const handleClear = () => {
    setInputText("");
    onTextChange?.("");
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="text-xs font-semibold text-slate-300 flex items-center gap-1 mb-1.5"
      >
        {icon ?? <MapPin className="h-3 w-3 text-cyan-400" />}
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          required={required}
          value={inputText}
          onChange={handleChange}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Start typing a location…"}
          className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
        />

        {/* Right icon: spinner / clear */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          {(loading || resolving) && (
            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin pointer-events-none" />
          )}
          {!loading && !resolving && inputText && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {open && predictions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 w-full bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto"
        >
          {predictions.map((pred) => (
            <li
              key={pred.place_id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click
                handleSelect(pred);
              }}
              className="flex items-start gap-2.5 px-4 py-3 cursor-pointer hover:bg-slate-800/80 transition-colors border-b border-slate-800/60 last:border-0"
            >
              <MapPin className="h-3.5 w-3.5 text-cyan-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-slate-200 leading-snug">{pred.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
