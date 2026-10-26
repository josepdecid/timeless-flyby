import { describe, expect, it } from 'vitest';
import { parseStravaLink, stravaGpxExportUrl } from '../strava';

describe('parseStravaLink', () => {
  it('reads the activity ID from full and partial links', () => {
    for (const link of [
      'https://www.strava.com/activities/12345678901',
      'https://www.strava.com/activities/12345678901/overview',
      'https://strava.com/activities/12345678901?share_sig=abc',
      'www.strava.com/activities/12345678901#comments',
      '  12345678901 ',
    ]) {
      expect(parseStravaLink(link)).toEqual({ kind: 'activity', id: '12345678901' });
    }
  });

  it('flags app share links, which carry no ID', () => {
    expect(parseStravaLink('https://strava.app.link/AbCdEf123')).toEqual({ kind: 'short' });
  });

  it('rejects other links', () => {
    for (const link of [
      'https://www.strava.com/routes/123456',
      'https://www.strava.com/athletes/123456',
      'https://example.com/activities/123456',
      'https://notstrava.com/activities/123456',
      'hello',
      '',
    ]) {
      expect(parseStravaLink(link)).toEqual({ kind: 'invalid' });
    }
  });

  it('builds the export URL', () => {
    expect(stravaGpxExportUrl('42')).toBe('https://www.strava.com/activities/42/export_gpx');
  });
});
