import React from 'react';
import { Globe, ExternalLink, Download } from 'lucide-react';
import { GeoDatabasesInfoState, formatFileDate, formatFileSize } from './types';
import { useI18n } from '../../i18n/i18nContext';

interface GeoDatabasesCardProps {
  geoInfo: GeoDatabasesInfoState | null;
  isUpdatingGeo: boolean;
  geoProgress?: number;
  onUpdateGeo: () => void;
}

export const GeoDatabasesCard: React.FC<GeoDatabasesCardProps> = ({
  geoInfo,
  isUpdatingGeo,
  geoProgress,
  onUpdateGeo,
}) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-extrabold text-slate-100 font-sans tracking-wide">{t('cores_geo_title')}</span>
          </div>
          <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
            {t('cores_geo_badge')}
          </span>
        </div>

        <a
          href="https://github.com/Loyalsoldier/v2ray-rules-dat"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1.5 text-xs text-purple-400 hover:text-purple-300 font-mono transition-colors"
        >
          <span>Loyalsoldier / SagerNet</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Geo Databases Status Rows */}
        <div className="space-y-2.5 pt-3 border-t border-white/5 font-mono text-xs">
          <div className="flex justify-between items-center gap-2 text-slate-400">
            <span className="shrink-0">{t('cores_geo_dat_status')}</span>
            <span className={geoInfo?.geoip_dat_exists ? "text-emerald-400 font-bold truncate" : "text-amber-400 font-medium shrink-0"}>
              {geoInfo?.geoip_dat_exists ? (
                <>
                  <span>{formatFileSize(geoInfo.geoip_dat_size + geoInfo.geosite_dat_size)}</span>
                  {Math.max(geoInfo.geoip_dat_mtime || 0, geoInfo.geosite_dat_mtime || 0) > 0 && (
                    <span className="text-slate-400 font-normal ml-1.5 text-[11px]">
                      ({formatFileDate(Math.max(geoInfo.geoip_dat_mtime || 0, geoInfo.geosite_dat_mtime || 0))})
                    </span>
                  )}
                </>
              ) : t('cores_not_installed')}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2 text-slate-400">
            <span className="shrink-0">{t('cores_geo_db_status')}</span>
            <span className={geoInfo?.geoip_db_exists ? "text-cyan-400 font-bold truncate" : "text-amber-400 font-medium shrink-0"}>
              {geoInfo?.geoip_db_exists ? (
                <>
                  <span>{formatFileSize(geoInfo.geoip_db_size + geoInfo.geosite_db_size)}</span>
                  {Math.max(geoInfo.geoip_db_mtime || 0, geoInfo.geosite_db_mtime || 0) > 0 && (
                    <span className="text-slate-400 font-normal ml-1.5 text-[11px]">
                      ({formatFileDate(Math.max(geoInfo.geoip_db_mtime || 0, geoInfo.geosite_db_mtime || 0))})
                    </span>
                  )}
                </>
              ) : t('cores_not_installed')}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2">
        {isUpdatingGeo ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-cyan-300">
              <span>{t('cores_geo_updating')}</span>
              <span>{geoProgress || 0}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                style={{ width: `${geoProgress || 0}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={onUpdateGeo}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-glow-cyan transition-all active:scale-95 cursor-pointer font-mono"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('cores_geo_update_btn')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
