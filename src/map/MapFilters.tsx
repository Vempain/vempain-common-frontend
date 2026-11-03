import {Button, DatePicker, Input, Select, Space} from "antd";
import type {Dayjs} from "dayjs";
import {useState} from "react";
import {useTranslation} from "react-i18next";
import {MAP_VIEW_TRANSLATION_DEFAULTS, type MapViewTranslationKey} from "./MapViewConfig";

/** A file type the user may pick on the map, as a Select option */
export interface MapFileTypeOption {
    value: string;
    label: string;
}

/** The filters as the user set them; applied as the `MapFilterRequest` fields of every request */
export interface MapFilterValues {
    fileType: string | null;
    from: Dayjs | null;
    to: Dayjs | null;
    tags: string[];
    search: string;
}

export const EMPTY_MAP_FILTERS: MapFilterValues = {fileType: null, from: null, to: null, tags: [], search: ""};

interface MapFiltersProps {
    fileTypes: MapFileTypeOption[];
    /** The filters the bar starts with */
    initialValue: MapFilterValues;
    /** Called with the filters when the user applies them (Apply, Enter in the search, Reset) */
    onApply: (filters: MapFilterValues) => void;
    /** Tag suggestions for the text typed into the tag field; without it the user types free tags */
    searchTags?: (search: string) => Promise<string[]>;
}

/**
 * The filter bar of the map: file type, the range of the time the resource was taken, tags and a file name text. The values are kept
 * locally until applied, so that typing does not refetch the map on every keystroke.
 */
export function MapFilters({fileTypes, initialValue, onApply, searchTags}: MapFiltersProps) {
    const {t} = useTranslation();
    const text = (key: MapViewTranslationKey, options?: Record<string, unknown>) => t(key, {defaultValue: MAP_VIEW_TRANSLATION_DEFAULTS[key], ...options});
    const [draft, setDraft] = useState<MapFilterValues>(initialValue);
    const [tagOptions, setTagOptions] = useState<string[]>([]);

    function suggestTags(search: string) {
        if (!searchTags) {
            return;
        }
        searchTags(search)
                .then(tags => setTagOptions(tags))
                .catch(() => setTagOptions([]));
    }

    function reset() {
        setDraft(EMPTY_MAP_FILTERS);
        onApply(EMPTY_MAP_FILTERS);
    }

    return (
            <Space wrap size={[12, 8]} style={{marginBottom: 12}} data-testid="map-filters">
                <Select<string>
                        allowClear
                        placeholder={text("MapView.filters.allFileTypes")}
                        aria-label={text("MapView.filters.fileType")}
                        style={{minWidth: 180}}
                        value={draft.fileType ?? undefined}
                        options={fileTypes}
                        onChange={fileType => setDraft(current => ({...current, fileType: fileType ?? null}))}
                />
                <DatePicker.RangePicker
                        allowEmpty={[true, true]}
                        aria-label={text("MapView.filters.dateRange")}
                        value={[draft.from, draft.to]}
                        onChange={range => setDraft(current => ({...current, from: range?.[0] ?? null, to: range?.[1] ?? null}))}
                />
                <Select<string[]>
                        mode="tags"
                        allowClear
                        placeholder={text("MapView.filters.tagsPlaceholder")}
                        aria-label={text("MapView.filters.tags")}
                        style={{minWidth: 220}}
                        value={draft.tags}
                        options={tagOptions.map(tag => ({value: tag, label: tag}))}
                        showSearch={searchTags ? {onSearch: suggestTags, filterOption: false} : true}
                        onChange={tags => setDraft(current => ({...current, tags}))}
                        tokenSeparators={[","]}
                />
                <Input
                        allowClear
                        placeholder={text("MapView.filters.search")}
                        aria-label={text("MapView.filters.search")}
                        style={{width: 200}}
                        value={draft.search}
                        onChange={event => setDraft(current => ({...current, search: event.target.value}))}
                        onPressEnter={() => onApply(draft)}
                />
                <Button type="primary" onClick={() => onApply(draft)}>{text("MapView.filters.apply")}</Button>
                <Button onClick={reset}>{text("MapView.filters.reset")}</Button>
            </Space>
    );
}
