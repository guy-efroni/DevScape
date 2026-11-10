import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ICodeGraph } from '@devscape/shared';
import { API_BASE_URL, API_PARSE_PATH } from '../app.constants';

@Injectable({ providedIn: 'root' })
export class CodeGraphService {
  private readonly _http: HttpClient = inject(HttpClient);
  private readonly _apiUrl: string = `${API_BASE_URL}${API_PARSE_PATH}`;

  public parse(directoryPath: string): Observable<ICodeGraph> {
    return this._http.post<ICodeGraph>(this._apiUrl, { directoryPath });
  }

}
